// ABOUTME: T-56. Retrying the new-course wizard after a failure must finish the same course, not create
// ABOUTME: another one. Real CourseBuilder + real services over an in-memory client with injected faults.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import CourseBuilder from "../CourseBuilder";
import { useCoursePermissions } from "@/hooks/useCoursePermissions";
import { mockSupabaseClient } from "@/test/mocks/supabase";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  createFakeDb,
  type FakeDb,
} from "@/components/course/builder/__tests__/fakeCreationDb";

const toastSpy = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastSpy }),
  toast: toastSpy,
}));
vi.mock("@/hooks/useCoursePermissions", () => ({
  useCoursePermissions: vi.fn(),
}));
vi.mock("@/contexts/AuthContext", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useAuth: () => ({ user: { id: "u1" } }),
}));

const RESULT = {
  title: "Resumable course",
  description: "d",
  outlineMethod: "scratch" as const,
  thumbnailFile: null,
  outline: [
    {
      title: "S1",
      lessons: [
        { title: "Intro", type: "page" as const },
        { title: "Check", type: "quiz" as const },
      ],
    },
    { title: "S2", lessons: [{ title: "Essay", type: "assignment" as const }] },
  ],
};
// The wizard is replaced by a probe that submits the same details each time, as the real one does on retry.
vi.mock("@/components/course/builder/teachable/NewCourseWizard", async () => {
  const { useState } = await import("react");
  return {
    NewCourseWizard: ({ onFinish }: any) => {
      const [err, setErr] = useState("");
      return (
        <div>
          <button
            type="button"
            onClick={() =>
              onFinish(RESULT, () => undefined).then(
                () => setErr("ok"),
                (e: any) => setErr(e.message),
              )
            }
          >
            create course
          </button>
          <div data-testid="wizard-result">{err}</div>
        </div>
      );
    },
  };
});
vi.mock("@/components/course/builder/teachable/TeachableShell", () => ({
  TeachableShell: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("@/components/course/builder/teachable/SetupGuideView", () => ({
  SetupGuideView: () => null,
}));
vi.mock("@/components/onboarding/InstructorBuilderTour", () => ({
  InstructorBuilderTour: () => null,
}));

let db: FakeDb;
const sizes = () =>
  Object.fromEntries(Object.entries(db.tables).map(([k, v]) => [k, v.size]));

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname}</div>;
}

beforeEach(() => {
  toastSpy.mockClear();
  db = createFakeDb();
  vi.mocked(useCoursePermissions).mockReturnValue({
    canEdit: true,
    isInstructor: true,
    isAdmin: false,
    loading: false,
    error: null,
  } as any);
  (mockSupabaseClient.from as any).mockImplementation((t: string) =>
    db.client.from(t),
  );
  (mockSupabaseClient.auth.getUser as any).mockResolvedValue({
    data: { user: { id: "u1" } },
    error: null,
  });
  render(
    <TooltipProvider>
      <MemoryRouter initialEntries={["/courses/new/builder"]}>
        <Routes>
          <Route path="/courses/new/builder" element={<CourseBuilder />} />
          <Route
            path="/courses/:courseId/builder"
            element={<div data-testid="builder-open" />}
          />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </TooltipProvider>,
  );
});

const attempt = async (expected: string | RegExp) => {
  fireEvent.click(screen.getByText("create course"));
  await waitFor(() =>
    expect(screen.getByTestId("wizard-result").textContent).toMatch(expected),
  );
};

describe("T-56 wizard retry resumes the same course", () => {
  it("W1 a lesson insert fails; the retry finishes the first course and creates no second one", async () => {
    db.faults.set("content_items#2", "fail");
    await attempt("content_items insert failed");
    expect(sizes()).toMatchObject({ courses: 1, modules: 1, content_items: 1 });
    const firstId = [...db.tables.courses.keys()][0];
    fireEvent.click(screen.getByText("create course"));
    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe(
        `/courses/${firstId}/builder`,
      ),
    );
    expect(sizes()).toMatchObject({
      courses: 1,
      modules: 2,
      content_items: 3,
      assignments: 1,
      quizzes: 1,
    });
  });

  it("W2 the quiz row fails after its lesson was inserted; the retry adds the quiz to that lesson", async () => {
    db.faults.set("quizzes#1", "fail");
    await attempt(/quizzes insert failed/);
    const quizItem = [...db.tables.content_items.values()].find(
      (i) => i.type === "quiz",
    );
    expect(quizItem).toBeTruthy();
    fireEvent.click(screen.getByText("create course"));
    await waitFor(() =>
      expect(screen.getByTestId("builder-open")).toBeInTheDocument(),
    );
    expect(sizes()).toMatchObject({ courses: 1, content_items: 3, quizzes: 1 });
    expect([...db.tables.quizzes.values()][0].content_item_id).toBe(
      quizItem.id,
    );
  });

  it("W3 the course insert committed but its response was lost; the retry does not make a second course", async () => {
    db.faults.set("courses#1", "commit-then-lose-response");
    await attempt("Failed to fetch");
    fireEvent.click(screen.getByText("create course"));
    await waitFor(() =>
      expect(screen.getByTestId("builder-open")).toBeInTheDocument(),
    );
    expect(sizes()).toMatchObject({ courses: 1, modules: 2, content_items: 3 });
  });

  it("W4 control: a clean run creates one course with every lesson and opens it", async () => {
    fireEvent.click(screen.getByText("create course"));
    await waitFor(() =>
      expect(screen.getByTestId("builder-open")).toBeInTheDocument(),
    );
    expect(sizes()).toMatchObject({
      courses: 1,
      modules: 2,
      content_items: 3,
      assignments: 1,
      quizzes: 1,
    });
  });
});
