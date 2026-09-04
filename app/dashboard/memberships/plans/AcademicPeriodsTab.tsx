"use client";

import { Badge } from "@/app/components/ui/shadcn/badge";
import { Button } from "@/app/components/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/shadcn/dialog";
import { Input } from "@/app/components/ui/shadcn/input";
import { Label } from "@/app/components/ui/shadcn/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/shadcn/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/shadcn/table";
import type { AcademicYear, Semester, SemesterTerm } from "@/lib/types/membership";
import { useState } from "react";
import {
  createAcademicYear,
  createSemester,
  deleteAcademicYear,
  deleteSemester,
  updateAcademicYear,
  updateSemester,
} from "./actions";

type Props = {
  semesters: Semester[];
  academicYears: AcademicYear[];
  onChange: () => void;
};

type YearFormState = {
  label: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
};

const EMPTY_YEAR_FORM: YearFormState = {
  label: "",
  start_date: "",
  end_date: "",
  is_current: false,
};

type SemesterFormState = {
  academic_year_id: string;
  label: string;
  term: SemesterTerm;
  start_date: string;
  end_date: string;
  is_current: boolean;
};

const EMPTY_SEMESTER_FORM: SemesterFormState = {
  academic_year_id: "",
  label: "",
  term: "fall",
  start_date: "",
  end_date: "",
  is_current: false,
};

export function AcademicPeriodsTab({ semesters, academicYears, onChange }: Props) {
  const [yearDialog, setYearDialog] = useState<
    { mode: "create" } | { mode: "edit"; year: AcademicYear } | null
  >(null);
  const [yearForm, setYearForm] = useState<YearFormState>(EMPTY_YEAR_FORM);
  const [yearBusy, setYearBusy] = useState(false);
  const [yearError, setYearError] = useState<string | null>(null);

  const [semesterDialog, setSemesterDialog] = useState<
    { mode: "create" } | { mode: "edit"; semester: Semester } | null
  >(null);
  const [semesterForm, setSemesterForm] = useState<SemesterFormState>(EMPTY_SEMESTER_FORM);
  const [semesterBusy, setSemesterBusy] = useState(false);
  const [semesterError, setSemesterError] = useState<string | null>(null);

  function academicYearLabel(id: string): string {
    return academicYears.find((y) => y.id === id)?.label ?? "Unknown year";
  }

  // Academic years -----------------------------------------------------

  function openCreateYear() {
    setYearForm(EMPTY_YEAR_FORM);
    setYearError(null);
    setYearDialog({ mode: "create" });
  }

  function openEditYear(year: AcademicYear) {
    setYearForm({
      label: year.label,
      start_date: year.start_date,
      end_date: year.end_date,
      is_current: year.is_current,
    });
    setYearError(null);
    setYearDialog({ mode: "edit", year });
  }

  async function handleSaveYear() {
    if (!yearForm.label.trim() || !yearForm.start_date || !yearForm.end_date) {
      setYearError("Fill in all fields.");
      return;
    }
    if (yearForm.end_date <= yearForm.start_date) {
      setYearError("End date must be after start date.");
      return;
    }

    setYearBusy(true);
    setYearError(null);

    const input = {
      label: yearForm.label.trim(),
      start_date: yearForm.start_date,
      end_date: yearForm.end_date,
      is_current: yearForm.is_current,
    };

    const res =
      yearDialog?.mode === "edit"
        ? await updateAcademicYear(yearDialog.year.id, input)
        : await createAcademicYear(input);

    setYearBusy(false);
    if (res.error) {
      setYearError(res.error);
      return;
    }
    setYearDialog(null);
    onChange();
  }

  async function handleDeleteYear(year: AcademicYear) {
    if (
      !confirm(
        `Delete "${year.label}"? This also deletes its semesters and any finance budgets tied to it, and fails if a membership plan or point history still references it. This cannot be undone.`
      )
    ) {
      return;
    }
    const res = await deleteAcademicYear(year.id);
    if (res.error) {
      alert(res.error);
      return;
    }
    onChange();
  }

  // Semesters ------------------------------------------------------------

  function openCreateSemester() {
    setSemesterForm({
      ...EMPTY_SEMESTER_FORM,
      academic_year_id: academicYears[0]?.id ?? "",
    });
    setSemesterError(null);
    setSemesterDialog({ mode: "create" });
  }

  function openEditSemester(semester: Semester) {
    setSemesterForm({
      academic_year_id: semester.academic_year_id,
      label: semester.label,
      term: semester.term,
      start_date: semester.start_date,
      end_date: semester.end_date,
      is_current: semester.is_current,
    });
    setSemesterError(null);
    setSemesterDialog({ mode: "edit", semester });
  }

  async function handleSaveSemester() {
    if (
      !semesterForm.academic_year_id ||
      !semesterForm.label.trim() ||
      !semesterForm.start_date ||
      !semesterForm.end_date
    ) {
      setSemesterError("Fill in all fields, including the academic year.");
      return;
    }
    if (semesterForm.end_date <= semesterForm.start_date) {
      setSemesterError("End date must be after start date.");
      return;
    }

    setSemesterBusy(true);
    setSemesterError(null);

    const input = {
      academic_year_id: semesterForm.academic_year_id,
      label: semesterForm.label.trim(),
      term: semesterForm.term,
      start_date: semesterForm.start_date,
      end_date: semesterForm.end_date,
      is_current: semesterForm.is_current,
    };

    const res =
      semesterDialog?.mode === "edit"
        ? await updateSemester(semesterDialog.semester.id, input)
        : await createSemester(input);

    setSemesterBusy(false);
    if (res.error) {
      setSemesterError(res.error);
      return;
    }
    setSemesterDialog(null);
    onChange();
  }

  async function handleDeleteSemester(semester: Semester) {
    if (
      !confirm(
        `Delete "${semester.label}"? This fails if a membership plan still references it. This cannot be undone.`
      )
    ) {
      return;
    }
    const res = await deleteSemester(semester.id);
    if (res.error) {
      alert(res.error);
      return;
    }
    onChange();
  }

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Academic years</h2>
          <Button onClick={openCreateYear}>Add academic year</Button>
        </div>

        <div className="rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Current</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {academicYears.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No academic years yet.
                  </TableCell>
                </TableRow>
              )}
              {academicYears.map((y) => (
                <TableRow key={y.id}>
                  <TableCell>{y.label}</TableCell>
                  <TableCell>{y.start_date}</TableCell>
                  <TableCell>{y.end_date}</TableCell>
                  <TableCell>
                    {y.is_current ? <Badge>Current</Badge> : null}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => openEditYear(y)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteYear(y)}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Semesters</h2>
          <Button onClick={openCreateSemester} disabled={academicYears.length === 0}>
            Add semester
          </Button>
        </div>

        {academicYears.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Add an academic year first before adding semesters.
          </p>
        )}

        <div className="rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Academic year</TableHead>
                <TableHead>Term</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Current</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {semesters.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No semesters yet.
                  </TableCell>
                </TableRow>
              )}
              {semesters.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.label}</TableCell>
                  <TableCell>{academicYearLabel(s.academic_year_id)}</TableCell>
                  <TableCell className="capitalize">{s.term}</TableCell>
                  <TableCell>{s.start_date}</TableCell>
                  <TableCell>{s.end_date}</TableCell>
                  <TableCell>
                    {s.is_current ? <Badge>Current</Badge> : null}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => openEditSemester(s)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteSemester(s)}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {yearDialog && (
        <Dialog open onOpenChange={(open) => !open && setYearDialog(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {yearDialog.mode === "edit" ? "Edit academic year" : "Add academic year"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <Label>Label</Label>
                <Input
                  value={yearForm.label}
                  onChange={(e) => setYearForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="2026-2027"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <Label>Start date</Label>
                  <Input
                    type="date"
                    value={yearForm.start_date}
                    onChange={(e) =>
                      setYearForm((f) => ({ ...f, start_date: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label>End date</Label>
                  <Input
                    type="date"
                    value={yearForm.end_date}
                    onChange={(e) => setYearForm((f) => ({ ...f, end_date: e.target.value }))}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={yearForm.is_current}
                  onChange={(e) =>
                    setYearForm((f) => ({ ...f, is_current: e.target.checked }))
                  }
                />
                Mark as the current academic year
              </label>

              {yearError && <p className="text-sm text-red-600 dark:text-red-400">{yearError}</p>}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setYearDialog(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveYear} disabled={yearBusy}>
                {yearBusy ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {semesterDialog && (
        <Dialog open onOpenChange={(open) => !open && setSemesterDialog(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {semesterDialog.mode === "edit" ? "Edit semester" : "Add semester"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <Label>Label</Label>
                <Input
                  value={semesterForm.label}
                  onChange={(e) => setSemesterForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="Fall 2026"
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label>Academic year</Label>
                <Select
                  value={semesterForm.academic_year_id}
                  onValueChange={(v) =>
                    v && setSemesterForm((f) => ({ ...f, academic_year_id: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an academic year">
                      {(v: string | null) => (v ? academicYearLabel(v) : "Choose an academic year")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {academicYears.map((y) => (
                      <SelectItem key={y.id} value={y.id}>
                        {y.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <Label>Term</Label>
                  <Select
                    value={semesterForm.term}
                    onValueChange={(v) =>
                      v && setSemesterForm((f) => ({ ...f, term: v as SemesterTerm }))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fall">Fall</SelectItem>
                      <SelectItem value="spring">Spring</SelectItem>
                      <SelectItem value="summer">Summer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <Label>Start date</Label>
                  <Input
                    type="date"
                    value={semesterForm.start_date}
                    onChange={(e) =>
                      setSemesterForm((f) => ({ ...f, start_date: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label>End date</Label>
                  <Input
                    type="date"
                    value={semesterForm.end_date}
                    onChange={(e) =>
                      setSemesterForm((f) => ({ ...f, end_date: e.target.value }))
                    }
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={semesterForm.is_current}
                  onChange={(e) =>
                    setSemesterForm((f) => ({ ...f, is_current: e.target.checked }))
                  }
                />
                Mark as the current semester
              </label>

              {semesterError && (
                <p className="text-sm text-red-600 dark:text-red-400">{semesterError}</p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSemesterDialog(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveSemester} disabled={semesterBusy}>
                {semesterBusy ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
