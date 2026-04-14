import type { DoctorInfo } from '../../domain';

interface DoctorCardProps {
  doctor: DoctorInfo | undefined;
}

export function DoctorCard({ doctor }: DoctorCardProps) {
  if (!doctor) return null;
  return (
    <div className="rounded border border-gray-200 bg-white p-4 text-sm">
      <p className="font-medium text-gray-900">{doctor.name}</p>
      {doctor.specialty && <p className="text-gray-600">{doctor.specialty}</p>}
      {doctor.address && <p className="text-gray-600">{doctor.address}</p>}
    </div>
  );
}
