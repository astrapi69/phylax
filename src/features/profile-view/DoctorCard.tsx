import type { DoctorInfo } from '../../domain';

interface DoctorCardProps {
  doctor: DoctorInfo | undefined;
}

export function DoctorCard({ doctor }: DoctorCardProps) {
  if (!doctor) return null;
  return (
    <div className="rounded-sm border border-gray-200 bg-white p-4 text-sm dark:border-gray-700 dark:bg-gray-900">
      <p className="font-medium text-gray-900 dark:text-gray-100">{doctor.name}</p>
      {doctor.specialty && <p className="text-gray-600 dark:text-gray-400">{doctor.specialty}</p>}
      {doctor.address && <p className="text-gray-600 dark:text-gray-400">{doctor.address}</p>}
    </div>
  );
}
