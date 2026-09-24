import { Navigate, Route, Routes } from "react-router-dom";
import { useSession } from "./lib/session";
import { Spinner, ErrorBox } from "./components/ui";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Eleves from "./pages/Eleves";
import EleveFiche from "./pages/EleveFiche";
import Classes from "./pages/Classes";
import Parametres from "./pages/Parametres";

export default function App() {
  const s = useSession();
  if (!s.token) return <Login />;
  if (s.bootError) return <div style={{ padding: 40, maxWidth: 520 }}><ErrorBox error={s.bootError} /><button className="btn" style={{ marginTop: 16 }} onClick={s.logout}>Revenir à la connexion</button></div>;
  if (!s.ready) return <Spinner />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="eleves" element={<Eleves />} />
        <Route path="eleves/:id" element={<EleveFiche />} />
        <Route path="classes" element={<Classes />} />
        <Route path="parametres/*" element={<Parametres />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
