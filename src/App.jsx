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
import Encaissements from "./pages/Encaissements";
import Impayes from "./pages/Impayes";
import Depenses from "./pages/Depenses";
import Recu from "./pages/Recu";
import Enseignants from "./pages/Enseignants";
import Notes from "./pages/Notes";
import Bulletins from "./pages/Bulletins";
import Absences from "./pages/Absences";
import Emploi, { EmploiImpression } from "./pages/Emploi";
import Recettes from "./pages/Recettes";
import Rapports from "./pages/Rapports";
import Service from "./pages/Service";
import Fournitures from "./pages/Fournitures";
import { ListeFournituresImpression } from "./pages/FournituresClasses";
import Vierges, { ViergesImpression } from "./pages/Vierges";
import Listes, { ListeImpression } from "./pages/Listes";
import MiseAJour from "./components/MiseAJour";
import Documents from "./pages/Documents";
import Factures, { FacturesImpression } from "./pages/Factures";

export default function App() {
  const s = useSession();
  if (!s.token) return <><Login /><MiseAJour /></>;
  if (s.bootError) return <div style={{ padding: 40, maxWidth: 520 }}><ErrorBox error={s.bootError} /><button className="btn" style={{ marginTop: 16 }} onClick={s.logout}>Revenir à la connexion</button></div>;
  if (!s.ready) return <Spinner />;
  return (
    <>
    <MiseAJour />
    <Routes>
      <Route path="recus/:id" element={<Recu />} />
      <Route path="documents" element={<Documents />} />
      <Route path="imprimes/imprimer" element={<ViergesImpression />} />
      <Route path="listes/imprimer" element={<ListeImpression />} />
      <Route path="fournitures/liste" element={<ListeFournituresImpression />} />
      {s.peut("pedagogie.lire") && <Route path="emploi/imprimer" element={<EmploiImpression />} />}
      {s.peut("finances.lire") && <Route path="factures/imprimer" element={<FacturesImpression />} />}
      {s.peut("pedagogie.lire") && <Route path="bulletins/imprimer" element={<Bulletins />} />}
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="eleves" element={<Eleves />} />
        <Route path="eleves/:id" element={<EleveFiche />} />
        <Route path="classes" element={<Classes />} />
        <Route path="imprimes" element={<Vierges />} />
        <Route path="listes" element={<Listes />} />
        <Route path="parametres/*" element={<Parametres />} />
        {s.peut("finances.lire") && <Route path="paiements" element={<Encaissements />} />}
        {s.peut("finances.lire") && <Route path="impayes" element={<Impayes />} />}
        {s.peut("finances.lire") && <Route path="factures" element={<Factures />} />}
        {s.peut("depenses.lire") && <Route path="depenses" element={<Depenses />} />}
        {s.peut("depenses.lire") && <Route path="recettes" element={<Recettes />} />}
        {s.peut("finances.lire") && <Route path="rapports" element={<Rapports />} />}
        {s.peut("finances.lire") && <Route path="services/:type" element={<Service />} />}
        {s.peut("finances.lire") && <Route path="fournitures" element={<Fournitures />} />}
        {s.peut("pedagogie.lire") && <Route path="notes" element={<Notes />} />}
        {s.peut("pedagogie.lire") && <Route path="absences" element={<Absences />} />}
        {s.peut("pedagogie.lire") && <Route path="enseignants" element={<Enseignants />} />}
        {s.peut("pedagogie.lire") && <Route path="emploi" element={<Emploi />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </>
  );
}
