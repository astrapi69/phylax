import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div>
      <h1 className="mb-2 text-xl font-bold text-gray-900 dark:text-gray-100">
        Seite nicht gefunden
      </h1>
      <p className="mb-4 text-gray-600 dark:text-gray-400">
        Die angeforderte Seite existiert nicht.
      </p>
      <Link
        to="/profile"
        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
      >
        Zurueck zum Profil
      </Link>
    </div>
  );
}
