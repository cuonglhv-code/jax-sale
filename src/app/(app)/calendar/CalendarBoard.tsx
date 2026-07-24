"use client";

import { useMemo, useState, useCallback } from "react";
import { Calendar, dateFnsLocalizer, Views, type View, type SlotInfo } from "react-big-calendar";
import withDragAndDrop, { type EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";
import { format, parse, startOfWeek, getDay, isSameDay } from "date-fns";
import { vi } from "date-fns/locale/vi";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./calendar.css";

import { useTasks } from "@/hooks/queries/useTasks";
import { useRescheduleTask } from "@/hooks/mutations/useRescheduleTask";
import { ALL_CENTRES, isNetworkWideRole, PRIORITY_COLOR } from "@/lib/domain/vocabulary";
import type { AppRole, TaskView } from "@/lib/data/types";
import { TaskDetailDrawer } from "./TaskDetailDrawer";
import { DayTaskList } from "./DayTaskList";
import { CreateTaskDrawer } from "../tasks/CreateTaskDrawer";

interface DepartmentOption {
  id: string;
  name: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  resource: TaskView;
}

const locales = { "vi-VN": vi };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

const DnDCalendar = withDragAndDrop<CalendarEvent>(Calendar as any);

function priorityStyle(event: CalendarEvent) {
  const color = PRIORITY_COLOR[event.resource.priority];
  return {
    style: {
      backgroundColor: color.bg,
      color: color.text,
      border: `1px solid ${color.border}`,
      borderRadius: "6px",
      fontSize: "12px",
      fontWeight: 600,
      padding: "2px 8px",
    },
  };
}

export function CalendarBoard({
  role,
  departments,
}: {
  role: AppRole;
  departments: DepartmentOption[];
}) {
  const [selectedTask, setSelectedTask] = useState<TaskView | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [dayListDate, setDayListDate] = useState<Date | null>(null);
  const [dayListOpen, setDayListOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [currentView, setCurrentView] = useState<View>(Views.MONTH);
  const [currentDate, setCurrentDate] = useState(new Date());

  const showSwitcher = isNetworkWideRole(role);
  const baseFilter = showSwitcher ? { pageSize: 100 } : { pageSize: 100 };
  const { data, isLoading, error } = useTasks(baseFilter);

  const reschedule = useRescheduleTask();

  const events: CalendarEvent[] = useMemo(() => {
    const rows = data?.rows ?? [];
    return rows.map((task) => ({
      id: task.id,
      title: task.description,
      start: new Date(task.deadline),
      end: new Date(task.deadline),
      allDay: true,
      resource: task,
    }));
  }, [data]);

  const handleSelectEvent = useCallback(
    (event: CalendarEvent) => {
      setSelectedTask(event.resource);
      setDetailOpen(true);
    },
    [],
  );

  const handleSelectSlot = useCallback(
    (slotInfo: SlotInfo) => {
      if (slotInfo.action === "click" || slotInfo.action === "select") {
        const dayTasks = events.filter((e) => isSameDay(e.start, slotInfo.start));
        if (dayTasks.length > 0) {
          setDayListDate(slotInfo.start);
          setDayListOpen(true);
        } else {
          setCreateOpen(true);
        }
      }
    },
    [events],
  );

  const handleEventDrop = useCallback(
    ({ event, start }: EventInteractionArgs<CalendarEvent>) => {
      const newDeadline = format(start as Date, "yyyy-MM-dd");
      if (newDeadline !== format(event.start, "yyyy-MM-dd")) {
        reschedule.mutate({
          taskId: event.id,
          newDeadline,
        });
      }
    },
    [reschedule],
  );

  const handleSelectDayTask = useCallback((task: TaskView) => {
    setDayListOpen(false);
    setSelectedTask(task);
    setDetailOpen(true);
  }, []);

  return (
    <div className="flex flex-col gap-[18px] px-6 py-5 pb-7">
      {isLoading && <p className="text-text-muted">Đang tải...</p>}
      {error && <p className="text-red">{error.message}</p>}

      <div style={{ height: "calc(100vh - 160px)", minHeight: 500 }}>
        <DnDCalendar
          localizer={localizer}
          events={events}
          views={[Views.MONTH, Views.WEEK, Views.DAY]}
          view={currentView}
          date={currentDate}
          onView={(view: View) => setCurrentView(view)}
          onNavigate={(date: Date) => setCurrentDate(date)}
          selectable
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          onEventDrop={handleEventDrop}
          eventPropGetter={priorityStyle}
          culture="vi-VN"
          messages={{
            today: "Hôm nay",
            previous: "Trước",
            next: "Tiếp",
            month: "Tháng",
            week: "Tuần",
            day: "Ngày",
            allDay: "Cả ngày",
          }}
        />
      </div>

      <TaskDetailDrawer
        task={selectedTask}
        isOpen={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelectedTask(null);
        }}
      />

      {dayListDate && (
        <DayTaskList
          date={dayListDate}
          tasks={events.filter((e) => isSameDay(e.start, dayListDate)).map((e) => e.resource)}
          onSelectTask={handleSelectDayTask}
          onClose={() => {
            setDayListOpen(false);
            setDayListDate(null);
          }}
        />
      )}

      <CreateTaskDrawer
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        departments={departments}
      />
    </div>
  );
}
