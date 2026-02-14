import ICAL from "ical.js";
import { ComponentType, Priority } from "@prisma/client";

// Types for converter input/output
export interface TatsuTodo {
  id: string;
  title: string;
  description: string | null;
  dtstart: Date;
  due: Date;
  rrule: string | null;
  exdates: Date[];
  priority: Priority;
  completed: boolean;
  pinned: boolean;
  order: number;
  timeZone: string;
  projectName?: string | null;
  durationMinutes: number;
}

export interface TatsuTodoInstance {
  id: string;
  todoId: string;
  instanceDate: Date;
  overriddenTitle: string | null;
  overriddenDescription: string | null;
  overriddenPriority: Priority | null;
  overriddenDtstart: Date | null;
  overriddenDue: Date | null;
  overriddenDurationMinutes: number | null;
  completedAt: Date | null;
}

export interface ParsedIcalResult {
  uid: string;
  title: string;
  description: string | null;
  dtstart: Date;
  due: Date | null;
  rrule: string | null;
  exdates: Date[];
  priority: Priority;
  completed: boolean;
  completedAt: Date | null;
  pinned: boolean;
  order: number | null;
  projectName: string | null;
  instances: ParsedIcalInstance[];
  unknownProperties: Array<{ name: string; value: string }>;
}

export interface ParsedIcalInstance {
  recurrenceId: Date;
  title: string | null;
  description: string | null;
  dtstart: Date | null;
  due: Date | null;
  priority: Priority | null;
  completed: boolean;
  completedAt: Date | null;
}

// Priority mapping: Tatsu -> iCal (RFC 5545)
export function tatsuPriorityToIcal(priority: Priority): number {
  switch (priority) {
    case "High":
      return 1;
    case "Medium":
      return 5;
    case "Low":
      return 9;
    default:
      return 0; // undefined
  }
}

// Priority mapping: iCal -> Tatsu
export function icalPriorityToTatsu(icalPriority: number): Priority {
  if (icalPriority >= 1 && icalPriority <= 3) return "High";
  if (icalPriority >= 4 && icalPriority <= 6) return "Medium";
  if (icalPriority >= 7 && icalPriority <= 9) return "Low";
  return "Low"; // 0 or undefined = Low
}

/**
 * Convert a Tatsu Todo (+ instances) to an iCalendar string.
 */
export function todoToIcal(
  todo: TatsuTodo,
  instances: TatsuTodoInstance[],
  componentType: ComponentType,
  uid?: string,
): string {
  const cal = new ICAL.Component(["vcalendar", [], []]);
  cal.updatePropertyWithValue("prodid", "-//Tatsu//CalDAV Sync//EN");
  cal.updatePropertyWithValue("version", "2.0");

  const compName = componentType === "VTODO" ? "vtodo" : "vevent";

  // Main component
  const comp = new ICAL.Component(compName);
  comp.updatePropertyWithValue("uid", uid || todo.id);
  comp.updatePropertyWithValue("summary", todo.title);

  if (todo.description) {
    comp.updatePropertyWithValue("description", todo.description);
  }

  // DTSTART with timezone
  const dtstart = ICAL.Time.fromJSDate(todo.dtstart, false);
  comp.updatePropertyWithValue("dtstart", dtstart);

  // DUE / DTEND
  if (componentType === "VTODO") {
    const due = ICAL.Time.fromJSDate(todo.due, false);
    comp.updatePropertyWithValue("due", due);
  } else {
    const dtend = ICAL.Time.fromJSDate(todo.due, false);
    comp.updatePropertyWithValue("dtend", dtend);
  }

  // RRULE
  if (todo.rrule) {
    // todo.rrule is like "FREQ=DAILY;INTERVAL=1" — strip "RRULE:" prefix if present
    const rruleStr = todo.rrule.replace(/^RRULE:/i, "");
    const recur = ICAL.Recur.fromString(rruleStr);
    comp.updatePropertyWithValue("rrule", recur);
  }

  // EXDATE
  for (const exdate of todo.exdates) {
    const exdateProp = new ICAL.Property("exdate");
    exdateProp.setValue(ICAL.Time.fromJSDate(exdate, false));
    comp.addProperty(exdateProp);
  }

  // PRIORITY
  comp.updatePropertyWithValue(
    "priority",
    tatsuPriorityToIcal(todo.priority),
  );

  // Completion status
  if (componentType === "VTODO") {
    if (todo.completed) {
      comp.updatePropertyWithValue("status", "COMPLETED");
      comp.updatePropertyWithValue(
        "completed",
        ICAL.Time.fromJSDate(new Date(), false),
      );
    } else {
      comp.updatePropertyWithValue("status", "NEEDS-ACTION");
    }
  } else {
    // VEVENT
    if (todo.completed) {
      comp.updatePropertyWithValue("status", "CANCELLED");
      comp.updatePropertyWithValue("x-tatsu-completed", "TRUE");
    }
  }

  // Custom properties
  if (todo.pinned) {
    comp.updatePropertyWithValue("x-tatsu-pinned", "TRUE");
  }
  comp.updatePropertyWithValue("x-tatsu-order", String(todo.order));

  // CATEGORIES from project
  if (todo.projectName) {
    comp.updatePropertyWithValue("categories", todo.projectName);
  }

  // LAST-MODIFIED
  comp.updatePropertyWithValue(
    "last-modified",
    ICAL.Time.fromJSDate(new Date(), false),
  );

  cal.addSubcomponent(comp);

  // Instance overrides as separate components with RECURRENCE-ID
  for (const inst of instances) {
    const instComp = new ICAL.Component(compName);
    instComp.updatePropertyWithValue("uid", uid || todo.id);

    // RECURRENCE-ID
    const recurId = ICAL.Time.fromJSDate(inst.instanceDate, false);
    instComp.updatePropertyWithValue("recurrence-id", recurId);

    // Use overridden values or fall back to parent
    instComp.updatePropertyWithValue(
      "summary",
      inst.overriddenTitle || todo.title,
    );

    const desc = inst.overriddenDescription ?? todo.description;
    if (desc) {
      instComp.updatePropertyWithValue("description", desc);
    }

    const instDtstart = inst.overriddenDtstart || todo.dtstart;
    instComp.updatePropertyWithValue(
      "dtstart",
      ICAL.Time.fromJSDate(instDtstart, false),
    );

    const instDue = inst.overriddenDue || todo.due;
    if (componentType === "VTODO") {
      instComp.updatePropertyWithValue(
        "due",
        ICAL.Time.fromJSDate(instDue, false),
      );
    } else {
      instComp.updatePropertyWithValue(
        "dtend",
        ICAL.Time.fromJSDate(instDue, false),
      );
    }

    instComp.updatePropertyWithValue(
      "priority",
      tatsuPriorityToIcal(inst.overriddenPriority || todo.priority),
    );

    // Completion for instance
    if (inst.completedAt) {
      if (componentType === "VTODO") {
        instComp.updatePropertyWithValue("status", "COMPLETED");
        instComp.updatePropertyWithValue(
          "completed",
          ICAL.Time.fromJSDate(inst.completedAt, false),
        );
      } else {
        instComp.updatePropertyWithValue("status", "CANCELLED");
        instComp.updatePropertyWithValue("x-tatsu-completed", "TRUE");
      }
    } else {
      if (componentType === "VTODO") {
        instComp.updatePropertyWithValue("status", "NEEDS-ACTION");
      }
    }

    cal.addSubcomponent(instComp);
  }

  return cal.toString();
}

/**
 * Parse an iCalendar string into Tatsu-compatible data.
 */
export function icalToTodo(
  icalData: string,
  componentType: ComponentType,
): ParsedIcalResult | null {
  const jcal = ICAL.parse(icalData);
  const cal = new ICAL.Component(jcal);

  const compName = componentType === "VTODO" ? "vtodo" : "vevent";
  const allComps = cal.getAllSubcomponents(compName);

  if (allComps.length === 0) return null;

  // Separate main component (no RECURRENCE-ID) from overrides
  let mainComp: ICAL.Component | null = null;
  const overrideComps: ICAL.Component[] = [];

  for (const comp of allComps) {
    if (comp.getFirstPropertyValue("recurrence-id")) {
      overrideComps.push(comp);
    } else {
      mainComp = comp;
    }
  }

  if (!mainComp) {
    // If all components have RECURRENCE-ID, use the first one as main
    mainComp = allComps[0];
  }

  const uid = mainComp.getFirstPropertyValue("uid") as string;
  const title = (mainComp.getFirstPropertyValue("summary") as string) || "";
  const description =
    (mainComp.getFirstPropertyValue("description") as string) || null;

  // Parse dates
  const dtstartVal = mainComp.getFirstPropertyValue("dtstart") as ICAL.Time;
  const dtstart = dtstartVal ? dtstartVal.toJSDate() : new Date();

  let due: Date | null = null;
  if (componentType === "VTODO") {
    const dueVal = mainComp.getFirstPropertyValue("due") as ICAL.Time;
    if (dueVal) due = dueVal.toJSDate();
  } else {
    const dtendVal = mainComp.getFirstPropertyValue("dtend") as ICAL.Time;
    if (dtendVal) due = dtendVal.toJSDate();
  }

  // RRULE
  let rrule: string | null = null;
  const rruleVal = mainComp.getFirstPropertyValue("rrule");
  if (rruleVal) {
    rrule = rruleVal.toString();
  }

  // EXDATE
  const exdates: Date[] = [];
  const exdateProps = mainComp.getAllProperties("exdate");
  for (const prop of exdateProps) {
    const val = prop.getFirstValue() as ICAL.Time;
    if (val) exdates.push(val.toJSDate());
  }

  // Priority
  const icalPriority =
    Number(mainComp.getFirstPropertyValue("priority")) || 0;
  const priority = icalPriorityToTatsu(icalPriority);

  // Completion
  let completed = false;
  let completedAt: Date | null = null;
  const status = mainComp.getFirstPropertyValue("status") as string;

  if (componentType === "VTODO") {
    completed = status === "COMPLETED";
    const completedVal = mainComp.getFirstPropertyValue(
      "completed",
    ) as ICAL.Time;
    if (completedVal) completedAt = completedVal.toJSDate();
  } else {
    // VEVENT: check custom property
    const tatsuCompleted = mainComp.getFirstPropertyValue(
      "x-tatsu-completed",
    ) as string;
    completed = tatsuCompleted === "TRUE" || status === "CANCELLED";
  }

  // Custom properties
  const pinnedVal = mainComp.getFirstPropertyValue(
    "x-tatsu-pinned",
  ) as string;
  const pinned = pinnedVal === "TRUE";

  const orderVal = mainComp.getFirstPropertyValue("x-tatsu-order") as string;
  const order = orderVal ? parseInt(orderVal, 10) : null;

  // CATEGORIES → project name
  const categories = mainComp.getFirstPropertyValue("categories") as string;
  const projectName = categories || null;

  // Collect unknown X-properties for round-tripping
  const unknownProperties: Array<{ name: string; value: string }> = [];
  for (const prop of mainComp.getAllProperties()) {
    const name = prop.name;
    if (
      name.startsWith("x-") &&
      name !== "x-tatsu-pinned" &&
      name !== "x-tatsu-order" &&
      name !== "x-tatsu-completed"
    ) {
      unknownProperties.push({
        name,
        value: prop.getFirstValue() as string,
      });
    }
  }

  // Parse override instances
  const instances: ParsedIcalInstance[] = overrideComps.map((comp) => {
    const recurIdVal = comp.getFirstPropertyValue(
      "recurrence-id",
    ) as ICAL.Time;
    const recurrenceId = recurIdVal.toJSDate();

    const instTitle =
      (comp.getFirstPropertyValue("summary") as string) || null;
    const instDesc =
      (comp.getFirstPropertyValue("description") as string) || null;

    const instDtstartVal = comp.getFirstPropertyValue("dtstart") as ICAL.Time;
    const instDtstart = instDtstartVal ? instDtstartVal.toJSDate() : null;

    let instDue: Date | null = null;
    if (componentType === "VTODO") {
      const v = comp.getFirstPropertyValue("due") as ICAL.Time;
      if (v) instDue = v.toJSDate();
    } else {
      const v = comp.getFirstPropertyValue("dtend") as ICAL.Time;
      if (v) instDue = v.toJSDate();
    }

    const instPriorityVal =
      Number(comp.getFirstPropertyValue("priority")) || 0;
    const instPriority = instPriorityVal
      ? icalPriorityToTatsu(instPriorityVal)
      : null;

    let instCompleted = false;
    let instCompletedAt: Date | null = null;
    const instStatus = comp.getFirstPropertyValue("status") as string;

    if (componentType === "VTODO") {
      instCompleted = instStatus === "COMPLETED";
      const cv = comp.getFirstPropertyValue("completed") as ICAL.Time;
      if (cv) instCompletedAt = cv.toJSDate();
    } else {
      const tc = comp.getFirstPropertyValue(
        "x-tatsu-completed",
      ) as string;
      instCompleted = tc === "TRUE" || instStatus === "CANCELLED";
    }

    return {
      recurrenceId,
      title: instTitle,
      description: instDesc,
      dtstart: instDtstart,
      due: instDue,
      priority: instPriority,
      completed: instCompleted,
      completedAt: instCompletedAt,
    };
  });

  return {
    uid,
    title,
    description,
    dtstart,
    due: due || dtstart,
    rrule,
    exdates,
    priority,
    completed,
    completedAt,
    pinned,
    order,
    projectName,
    instances,
    unknownProperties,
  };
}
