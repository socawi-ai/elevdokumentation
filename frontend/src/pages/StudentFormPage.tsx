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
      <form className="form-card" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="firstName">Förnamn</label>
          <input
            id="firstName"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="lastName">Efternamn</label>
          <input
            id="lastName"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="group">Klass</label>
          <input
            id="group"
            value={form.group}
            onChange={(e) => setForm({ ...form, group: e.target.value })}
            placeholder="t.ex. TE23A"
            required
          />
        </div>
        <button className="btn btn-primary" type="submit">
          {isEdit ? "Spara" : "Skapa"}
        </button>
      </form>
    </div>
  );
}
