"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { RentalInput } from "@/types/rental";
import { usePatrol } from "../../context/PatrolContext";

const facilityOptions = [
  {
    facility: "CP - Diamond #1",
    park: "Centennial Park",
    equipmentType: "Field - Baseball",
  },
  {
    facility: "CP - Diamond #2",
    park: "Centennial Park",
    equipmentType: "Field - Baseball",
  },
  {
    facility: "CP - Diamond #3",
    park: "Centennial Park",
    equipmentType: "Field - Baseball",
  },
  {
    facility: "CP - Soccer #1",
    park: "Centennial Park",
    equipmentType: "Field - Soccer",
  },
  {
    facility: "CP - Soccer #2",
    park: "Centennial Park",
    equipmentType: "Field - Soccer",
  },
  {
    facility: "HBP - Diamond #1",
    park: "Harold Black Park",
    equipmentType: "Field - Baseball",
  },
  {
    facility: "HBP - Diamond #2",
    park: "Harold Black Park",
    equipmentType: "Field - Baseball",
  },
  {
    facility: "HBP - Soccer Field",
    park: "Harold Black Park",
    equipmentType: "Field - Soccer",
  },
  {
    facility: "NPP - Diamond #1",
    park: "North Pelham Park",
    equipmentType: "Field - Baseball",
  },
  {
    facility: "NPP - Diamond #2",
    park: "North Pelham Park",
    equipmentType: "Field - Baseball",
  },
  {
    facility: "Glynn A. Green Field - Soccer",
    park: "Glynn A. Green",
    equipmentType: "Field - Soccer",
  },
] as const;

const initialForm: RentalInput = {
  rentalDate: "",
  park: facilityOptions[0].park,
  facility: facilityOptions[0].facility,
  equipmentType: facilityOptions[0].equipmentType,
  startTime: "",
  endTime: "",
  eventName: "",
  eventType: "",
  scheduleType: "",
  organization: "",
  contactName: "",
  contactPhone: "",
  permitNumber: "",
  attendanceQuantity: "",
  notes: "",
};

const fields: {
  name: keyof RentalInput;
  label: string;
  placeholder?: string;
  required?: boolean;
}[] = [
  { name: "rentalDate", label: "Reservation Date", placeholder: "Jun 9, 2026" },
  { name: "startTime", label: "Start Time", placeholder: "6:00 PM", required: true },
  { name: "endTime", label: "End Time", placeholder: "8:30 PM", required: true },
  { name: "eventName", label: "Event", placeholder: "Baseball Games" },
  { name: "eventType", label: "Event Type", placeholder: "External Reservation" },
  { name: "scheduleType", label: "Schedule Type", placeholder: "Ball Diamond - Games with Lines" },
  { name: "organization", label: "Organization", placeholder: "Local Sports Association" },
  { name: "contactName", label: "Contact Name", placeholder: "Rental Contact" },
  { name: "contactPhone", label: "Contact Phone", placeholder: "(905) 000-0000" },
  { name: "permitNumber", label: "Permit Number", placeholder: "R10001" },
  { name: "attendanceQuantity", label: "Attendance / Qty", placeholder: "30" },
];

export default function NewRentalPage() {
  const router = useRouter();
  const { addRental } = usePatrol();
  const [form, setForm] = useState<RentalInput>(initialForm);

  function updateField(name: keyof RentalInput, value: string) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function updateFacility(facility: string) {
    const option =
      facilityOptions.find((item) => item.facility === facility) ??
      facilityOptions[0];

    setForm((current) => ({
      ...current,
      facility: option.facility,
      park: option.park,
      equipmentType: option.equipmentType,
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    addRental(form);
    router.push("/rentals");
  }

  return (
    <main className="space-y-4 p-4">
      <header className="pt-2">
        <h1 className="text-3xl font-bold">Enter Rental</h1>
        <p className="mt-1 text-slate-600">
          Use the same fields as the rental sheet.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold">Rental Details</h2>
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-sm font-bold text-slate-700">
                Facility / Equipment
              </span>
              <select
                value={form.facility}
                onChange={(event) => updateFacility(event.target.value)}
                className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base outline-none focus:border-slate-950"
              >
                {facilityOptions.map((option) => (
                  <option key={option.facility} value={option.facility}>
                    {option.facility}
                  </option>
                ))}
              </select>
            </label>

            {fields.map((field) => (
              <label key={field.name} className="block">
                <span className="text-sm font-bold text-slate-700">
                  {field.label}
                </span>
                <input
                  value={form[field.name]}
                  onChange={(event) => updateField(field.name, event.target.value)}
                  required={field.required}
                  placeholder={field.placeholder}
                  className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-3 text-base outline-none focus:border-slate-950"
                />
              </label>
            ))}

            <label className="block">
              <span className="text-sm font-bold text-slate-700">Notes</span>
              <textarea
                value={form.notes}
                onChange={(event) => updateField("notes", event.target.value)}
                placeholder="Any sheet notes or patrol details"
                className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 p-3 text-base outline-none focus:border-slate-950"
              />
            </label>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => router.push("/rentals")}
            className="min-h-14 rounded-lg border border-slate-300 bg-white px-4 font-bold text-slate-950 shadow-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="min-h-14 rounded-lg bg-slate-950 px-4 font-bold text-white shadow-sm"
          >
            Add Rental
          </button>
        </div>
      </form>
    </main>
  );
}
