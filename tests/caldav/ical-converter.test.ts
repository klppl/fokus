import {
  todoToIcal,
  icalToTodo,
  localPriorityToIcal,
  icalPriorityToLocal,
  LocalTodo,
  LocalTodoInstance,
} from "@/lib/caldav/ical-converter";

function makeTodo(overrides: Partial<LocalTodo> = {}): LocalTodo {
  return {
    id: "test-todo-1",
    title: "Test Todo",
    description: "A test description",
    dtstart: new Date("2025-03-01T09:00:00Z"),
    due: new Date("2025-03-01T10:00:00Z"),
    rrule: null,
    exdates: [],
    priority: "Medium",
    completed: false,
    pinned: false,
    order: 1,
    timeZone: "UTC",
    projectName: null,
    durationMinutes: 60,
    ...overrides,
  };
}

function makeInstance(
  overrides: Partial<LocalTodoInstance> = {},
): LocalTodoInstance {
  return {
    id: "inst-1",
    todoId: "test-todo-1",
    instanceDate: new Date("2025-03-02T09:00:00Z"),
    overriddenTitle: null,
    overriddenDescription: null,
    overriddenPriority: null,
    overriddenDtstart: null,
    overriddenDue: null,
    overriddenDurationMinutes: null,
    completedAt: null,
    ...overrides,
  };
}

describe("Priority mapping", () => {
  test("localPriorityToIcal maps correctly", () => {
    expect(localPriorityToIcal("High")).toBe(1);
    expect(localPriorityToIcal("Medium")).toBe(5);
    expect(localPriorityToIcal("Low")).toBe(9);
  });

  test("icalPriorityToLocal maps correctly", () => {
    expect(icalPriorityToLocal(1)).toBe("High");
    expect(icalPriorityToLocal(2)).toBe("High");
    expect(icalPriorityToLocal(3)).toBe("High");
    expect(icalPriorityToLocal(4)).toBe("Medium");
    expect(icalPriorityToLocal(5)).toBe("Medium");
    expect(icalPriorityToLocal(6)).toBe("Medium");
    expect(icalPriorityToLocal(7)).toBe("Low");
    expect(icalPriorityToLocal(8)).toBe("Low");
    expect(icalPriorityToLocal(9)).toBe("Low");
    expect(icalPriorityToLocal(0)).toBe("Low");
  });

  test("priority round-trip", () => {
    for (const p of ["High", "Medium", "Low"] as const) {
      const ical = localPriorityToIcal(p);
      const back = icalPriorityToLocal(ical);
      expect(back).toBe(p);
    }
  });
});

describe("VTODO conversion", () => {
  test("basic todo round-trip", () => {
    const todo = makeTodo();
    const ical = todoToIcal(todo, [], "VTODO", "uid-123");
    expect(ical).toContain("VTODO");
    expect(ical).toContain("SUMMARY:Test Todo");
    expect(ical).toContain("DESCRIPTION:A test description");
    expect(ical).toContain("uid-123");

    const parsed = icalToTodo(ical, "VTODO");
    expect(parsed).not.toBeNull();
    expect(parsed!.uid).toBe("uid-123");
    expect(parsed!.title).toBe("Test Todo");
    expect(parsed!.description).toBe("A test description");
    expect(parsed!.priority).toBe("Medium");
    expect(parsed!.completed).toBe(false);
  });

  test("completed todo", () => {
    const todo = makeTodo({ completed: true });
    const ical = todoToIcal(todo, [], "VTODO");

    expect(ical).toContain("STATUS:COMPLETED");

    const parsed = icalToTodo(ical, "VTODO");
    expect(parsed!.completed).toBe(true);
  });

  test("pinned and order custom properties", () => {
    const todo = makeTodo({ pinned: true, order: 42 });
    const ical = todoToIcal(todo, [], "VTODO");

    expect(ical).toContain("X-TATSU-PINNED:TRUE");
    expect(ical).toContain("X-TATSU-ORDER:42");

    const parsed = icalToTodo(ical, "VTODO");
    expect(parsed!.pinned).toBe(true);
    expect(parsed!.order).toBe(42);
  });

  test("project name via CATEGORIES", () => {
    const todo = makeTodo({ projectName: "Work" });
    const ical = todoToIcal(todo, [], "VTODO");

    expect(ical).toContain("CATEGORIES:Work");

    const parsed = icalToTodo(ical, "VTODO");
    expect(parsed!.projectName).toBe("Work");
  });
});

describe("VEVENT conversion", () => {
  test("basic vevent round-trip", () => {
    const todo = makeTodo();
    const ical = todoToIcal(todo, [], "VEVENT", "uid-vevent");

    expect(ical).toContain("VEVENT");
    expect(ical).toContain("DTEND");
    expect(ical).not.toContain("VTODO");

    const parsed = icalToTodo(ical, "VEVENT");
    expect(parsed).not.toBeNull();
    expect(parsed!.title).toBe("Test Todo");
  });

  test("completed vevent uses X-TATSU-COMPLETED", () => {
    const todo = makeTodo({ completed: true });
    const ical = todoToIcal(todo, [], "VEVENT");

    expect(ical).toContain("X-TATSU-COMPLETED:TRUE");
    expect(ical).toContain("STATUS:CANCELLED");

    const parsed = icalToTodo(ical, "VEVENT");
    expect(parsed!.completed).toBe(true);
  });
});

describe("RRULE round-trip", () => {
  test("daily recurrence", () => {
    const todo = makeTodo({ rrule: "FREQ=DAILY;INTERVAL=1" });
    const ical = todoToIcal(todo, [], "VTODO");

    expect(ical).toContain("RRULE:");

    const parsed = icalToTodo(ical, "VTODO");
    expect(parsed!.rrule).not.toBeNull();
    expect(parsed!.rrule!.toUpperCase()).toContain("FREQ=DAILY");
  });

  test("weekly recurrence with BYDAY", () => {
    const todo = makeTodo({
      rrule: "FREQ=WEEKLY;BYDAY=MO,WE,FR",
    });
    const ical = todoToIcal(todo, [], "VTODO");

    const parsed = icalToTodo(ical, "VTODO");
    expect(parsed!.rrule).not.toBeNull();
    expect(parsed!.rrule!.toUpperCase()).toContain("FREQ=WEEKLY");
    expect(parsed!.rrule!.toUpperCase()).toContain("BYDAY");
  });

  test("monthly recurrence with COUNT", () => {
    const todo = makeTodo({
      rrule: "FREQ=MONTHLY;COUNT=12",
    });
    const ical = todoToIcal(todo, [], "VTODO");

    const parsed = icalToTodo(ical, "VTODO");
    expect(parsed!.rrule).not.toBeNull();
    expect(parsed!.rrule!.toUpperCase()).toContain("FREQ=MONTHLY");
    expect(parsed!.rrule!.toUpperCase()).toContain("COUNT=12");
  });
});

describe("EXDATE handling", () => {
  test("exdates round-trip", () => {
    const exdate1 = new Date("2025-03-05T09:00:00Z");
    const exdate2 = new Date("2025-03-10T09:00:00Z");
    const todo = makeTodo({
      rrule: "FREQ=DAILY",
      exdates: [exdate1, exdate2],
    });
    const ical = todoToIcal(todo, [], "VTODO");

    expect(ical).toContain("EXDATE");

    const parsed = icalToTodo(ical, "VTODO");
    expect(parsed!.exdates).toHaveLength(2);
  });
});

describe("RECURRENCE-ID / TodoInstance mapping", () => {
  test("instance override round-trip", () => {
    const todo = makeTodo({ rrule: "FREQ=DAILY" });
    const instance = makeInstance({
      overriddenTitle: "Override Title",
      overriddenPriority: "High",
      overriddenDtstart: new Date("2025-03-02T10:00:00Z"),
      overriddenDue: new Date("2025-03-02T11:00:00Z"),
    });

    const ical = todoToIcal(todo, [instance], "VTODO", "uid-recur");

    expect(ical).toContain("RECURRENCE-ID");
    expect(ical).toContain("Override Title");

    const parsed = icalToTodo(ical, "VTODO");
    expect(parsed!.instances).toHaveLength(1);
    expect(parsed!.instances[0].title).toBe("Override Title");
    expect(parsed!.instances[0].priority).toBe("High");
  });

  test("completed instance", () => {
    const todo = makeTodo({ rrule: "FREQ=DAILY" });
    const instance = makeInstance({
      completedAt: new Date("2025-03-02T12:00:00Z"),
    });

    const ical = todoToIcal(todo, [instance], "VTODO", "uid-inst-comp");

    const parsed = icalToTodo(ical, "VTODO");
    expect(parsed!.instances[0].completed).toBe(true);
    expect(parsed!.instances[0].completedAt).toBeTruthy();
  });

  test("multiple instances", () => {
    const todo = makeTodo({ rrule: "FREQ=DAILY" });
    const instances = [
      makeInstance({
        id: "inst-1",
        instanceDate: new Date("2025-03-02T09:00:00Z"),
        overriddenTitle: "Day 2",
      }),
      makeInstance({
        id: "inst-2",
        instanceDate: new Date("2025-03-03T09:00:00Z"),
        overriddenTitle: "Day 3",
        overriddenPriority: "Low",
      }),
    ];

    const ical = todoToIcal(todo, instances, "VTODO");

    const parsed = icalToTodo(ical, "VTODO");
    expect(parsed!.instances).toHaveLength(2);
  });
});

describe("X-property preservation", () => {
  test("unknown X-properties are collected", () => {
    const ical = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VTODO",
      "UID:custom-xprop-test",
      "SUMMARY:Test",
      "DTSTART:20250301T090000Z",
      "DUE:20250301T100000Z",
      "X-CUSTOM-PROP:hello world",
      "X-ANOTHER:value",
      "END:VTODO",
      "END:VCALENDAR",
    ].join("\r\n");

    const parsed = icalToTodo(ical, "VTODO");
    expect(parsed).not.toBeNull();
    expect(parsed!.unknownProperties.length).toBeGreaterThanOrEqual(2);
    expect(
      parsed!.unknownProperties.find((p) => p.name === "x-custom-prop"),
    ).toBeTruthy();
    expect(
      parsed!.unknownProperties.find((p) => p.name === "x-another"),
    ).toBeTruthy();
  });
});
