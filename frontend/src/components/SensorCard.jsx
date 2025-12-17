import React from "react";

export const SensorCard = ({
  icon: Icon,
  value,
  label,
  status,
  colorClass,
}) => {
  return (
    <div className={`card ${colorClass}`}>
      <Icon size={32} />
      <div className="card-content">
        <h3>{value}</h3>
        <p>{label}</p>
        {status && (
          <span className={`badge ${status.color}`}>{status.text}</span>
        )}
      </div>
    </div>
  );
};
