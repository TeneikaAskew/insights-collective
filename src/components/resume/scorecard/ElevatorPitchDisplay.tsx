
import React from 'react';

interface ElevatorPitchDisplayProps {
  elevatorPitch: string;
}

export const ElevatorPitchDisplay: React.FC<ElevatorPitchDisplayProps> = ({ elevatorPitch }) => {
  return (
    <div className="bg-accent/10 border-l-4 border-[#9b87f5] rounded-md p-4">
      <p className="font-medium mb-1">Elevator Pitch:</p>
      <p className="text-sm italic">{elevatorPitch || "No elevator pitch available."}</p>
    </div>
  );
};
