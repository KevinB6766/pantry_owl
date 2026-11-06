"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, Location } from "@/lib/api";
import { getSelectedLocation, setSelectedLocation } from "@/lib/pantry";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function displayTime(value: string): string {
  const [hourText, minuteText] = value.split(":");
  const date = new Date();
  date.setHours(Number(hourText), Number(minuteText), 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function displayClosure(closure: Location["closures"][number], timezone: string): string {
  const starts = new Date(closure.starts_at).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  });
  const ends = new Date(closure.ends_at).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  });
  return `${starts} – ${ends}`;
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<Location[]>("/locations")
      .then((result) => {
        setLocations(result);
        const preferred = getSelectedLocation();
        if (result.some((location) => location.id === preferred)) setSelected(preferred!);
        else if (result[0]) setSelected(result[0].id);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className="stack page-stack">
      <h1>Pantry locations</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {!locations.length && !error && <p className="muted">No active pantry locations are listed.</p>}
      {locations.map((location) => (
        <section className="location-card" key={location.id}>
          <div className="row">
            <h2>{location.name}</h2>
            <button
              type="button"
              aria-pressed={selected === location.id}
              onClick={() => {
                setSelected(location.id);
                setSelectedLocation(location.id);
              }}
            >
              {selected === location.id ? "Selected" : "Choose"}
            </button>
          </div>
          <p className={location.open_now ? "status-open" : "status-closed"}>{location.status_message}</p>
          <p>{[location.building_room, location.street_address, location.city, location.state, location.postal_code]
            .filter(Boolean).join(", ")}</p>
          {location.directions_note && <p>{location.directions_note}</p>}
          {location.accessibility_note && <p><strong>Accessibility:</strong> {location.accessibility_note}</p>}
          {location.phone && <p>Phone: <a href={`tel:${location.phone}`}>{location.phone}</a></p>}
          {location.contact_email && <p>Email: <a href={`mailto:${location.contact_email}`}>{location.contact_email}</a></p>}
          {location.street_address && (
            <p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${location.street_address}, ${location.city}, ${location.state} ${location.postal_code}`,
                )}`}
                target="_blank"
                rel="noreferrer"
              >
                Directions
              </a>
            </p>
          )}
          <h3>Weekly hours</h3>
          <ul className="hours-list">
            {DAYS.map((day, index) => {
              const windows = location.hours.filter((entry) => entry.day_of_week === index);
              return (
                <li key={day}>
                  <span>{day}</span>
                  <span>{windows.length
                    ? windows.map((window) => `${displayTime(window.opens_at)}–${displayTime(window.closes_at)}`).join(", ")
                    : "Closed"}</span>
                </li>
              );
            })}
          </ul>
          {location.closures.map((closure) => (
            <p className="notice" key={closure.starts_at}>
              <strong>{closure.message || (closure.is_closed ? "Temporary closure" : "Special hours")}</strong>
              <br />
              {displayClosure(closure, location.timezone)}
              {!closure.is_closed && closure.opens_at && closure.closes_at
                ? ` · ${displayTime(closure.opens_at)}–${displayTime(closure.closes_at)}`
                : ""}
            </p>
          ))}
          <p className="muted">{location.weekly_points} points per person each week</p>
        </section>
      ))}
      <Link href="/">Back to items</Link>
    </div>
  );
}
