import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createStudent, getStudent, updateStudent, type StudentInput } from "../api/students";

const emptyForm: StudentInput = { firstName: "", lastName: "", birthDate: null, notes: null };

export default function StudentFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState<StudentInput>(emptyForm);

  useEffect(() => {
    if (id) {
      getStudent(id).then((s) =>
        setForm({ firstName: s.firstName, lastName: s.lastName, birthDate: s.birthDate, notes: s.notes }),
      );
    }
  }, [id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isEdit && id) {
      await updateStudent(id, form);
    } else {
      await createStudent(form);
    }
    navigate("/");
  }

  return (
    <div>
      <h1>{isEdit ? "Edit student" : "New student"}</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>
            First name
            <input
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              required
            />
          </label>
        </div>
        <div>
          <label>
            Last name
            <input
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              required
            />
          </label>
        </div>
        <div>
          <label>
            Birth date
            <input
              type="date"
              value={form.birthDate ?? ""}
              onChange={(e) => setForm({ ...form, birthDate: e.target.value || null })}
            />
          </label>
        </div>
        <div>
          <label>
            Notes
            <textarea
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value || null })}
            />
          </label>
        </div>
        <button type="submit">{isEdit ? "Save" : "Create"}</button>
      </form>
    </div>
  );
}
