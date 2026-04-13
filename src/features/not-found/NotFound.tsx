import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div>
      <h1 className="mb-2 text-xl font-bold text-gray-900">Seite nicht gefunden</h1>
      <p className="mb-4 text-gray-600">Die angeforderte Seite existiert nicht.</p>
      <Link to="/profile" className="text-blue-600 hover:text-blue-800">
        Zurueck zum Profil
      </Link>
    </div>
  );
}
