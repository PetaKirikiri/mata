import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Classroom from '@/pages/Classroom';
import Login from '@/pages/Login';

function ClassroomRedirect() {
  const location = useLocation();
  return <Navigate to={`/classroom${location.search}`} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ClassroomRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/classroom" element={<Classroom />} />
      <Route path="*" element={<ClassroomRedirect />} />
    </Routes>
  );
}
