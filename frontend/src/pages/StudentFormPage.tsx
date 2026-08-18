import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createStudent, getStudent, updateStudent, type StudentInput } from "../api/students";

const emptyForm: StudentInput = { firstName: "", lastName: "", group: "" };

export default function StudentFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState<StudentInput>(emptyForm);

  useEffect(() => {
    if (id) {
      getStudent(id).then((s) => setForm({ firstName: s.firstName, lastName: s.lastName, group: s.group }));
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
      <h1>{isEdit ? "Redigera elev" : "Ny elev"}</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>
            Förnamn
            <input
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              required
            />
          </label>
        </div>
        <div>
          <label>
            Efternamn
            <input
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              required
            />
          </label>
        </div>
        <div>
          <label>
            Klass
            <input
              value={form.group}
              onChange={(e) => setForm({ ...form, group: e.target.value })}
              placeholder="t.ex. TE23A"
              required
            />
          </label>
        </div>
        <button type="submit">{isEdit ? "Spara" : "Skapa"}</button>
      </form>
    </div>
  );
}
