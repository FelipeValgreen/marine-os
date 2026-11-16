"use client";

import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Ship,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Anchor,
  Fuel,
  Droplets,
  Ruler,
  Clock,
  Compass,
  X,
  Save,
  AlertTriangle,
} from "lucide-react";
import {
  db,
  DEMO_IDS,
  enqueueOfflineMutation,
  type VesselRecord,
} from "@/lib/offline/db";
import { useMarineContext } from "@/components/ThemeProvider";

interface VesselFormData {
  id?: string;
  name: string;
  registration_number: string;
  vessel_type: "sailboat" | "catamaran" | "motor_yacht";
  loa_meters: number;
  beam_meters: number;
  draft_meters: number;
  mast_height_meters: number;
  fuel_capacity_l: number;
  water_capacity_l: number;
  engine_hours_current: number;
}

const EMPTY_FORM: VesselFormData = {
  name: "",
  registration_number: "",
  vessel_type: "sailboat",
  loa_meters: 12.0,
  beam_meters: 4.0,
  draft_meters: 2.0,
  mast_height_meters: 18.0,
  fuel_capacity_l: 200,
  water_capacity_l: 300,
  engine_hours_current: 0,
};

export function FleetManager() {
  const { theme, pushToast } = useMarineContext();
  const isNight = theme === "night-red-shift";

  const vessels = useLiveQuery(() => db.vessels.toArray(), [], []);
  const userPrefs = useLiveQuery(() => db.user_preferences.get("default"), []);

  const activeVesselId = userPrefs?.active_vessel_id || DEMO_IDS.VESSEL_ID;

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<VesselFormData>(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleOpenCreate = () => {
    setFormData({
      ...EMPTY_FORM,
      registration_number: `CB-${Math.floor(1000 + Math.random() * 9000)}`,
    });
    setIsEditing(true);
  };

  const handleOpenEdit = (vessel: VesselRecord) => {
    setFormData({
      id: vessel.id,
      name: vessel.name,
      registration_number: vessel.registration_number,
      vessel_type: vessel.vessel_type,
      loa_meters: vessel.loa_meters,
      beam_meters: vessel.beam_meters,
      draft_meters: vessel.draft_meters,
      mast_height_meters: vessel.mast_height_meters,
      fuel_capacity_l: vessel.fuel_capacity_l,
      water_capacity_l: vessel.water_capacity_l,
      engine_hours_current: vessel.engine_hours_current,
    });
    setIsEditing(true);
  };

  const handleSelectActiveVessel = async (vesselId: string) => {
    const existing = await db.user_preferences.get("default");
    const updated = {
      ...(existing || {
        id: "default",
        has_completed_onboarding: true,
        tooltip_gps_seen: true,
        tooltip_zarpe_pdf_seen: true,
        completed_lessons: [],
      }),
      active_vessel_id: vesselId,
      updated_at: new Date().toISOString(),
    };
    await db.user_preferences.put(updated);
    const chosen = vessels?.find((v) => v.id === vesselId);
    pushToast({
      title: "Barco Activo Seleccionado",
      subtitle: `${chosen?.name || "Barco"} es ahora la embarcación activa de la flota`,
      tone: "emerald",
    });
  };

  const handleSaveVessel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.registration_number.trim()) {
      pushToast({
        title: "Campos Requeridos",
        subtitle: "Nombre y Matrícula son obligatorios",
        tone: "coral",
      });
      return;
    }

    const isNew = !formData.id;
    const vesselId = formData.id || `vessel-${Date.now()}`;
    const now = new Date().toISOString();

    const record: VesselRecord = {
      id: vesselId,
      org_id: DEMO_IDS.ORG_ID,
      name: formData.name.trim(),
      registration_number: formData.registration_number.trim().toUpperCase(),
      vessel_type: formData.vessel_type,
      loa_meters: Number(formData.loa_meters) || 12.0,
      beam_meters: Number(formData.beam_meters) || 4.0,
      draft_meters: Number(formData.draft_meters) || 2.0,
      mast_height_meters: Number(formData.mast_height_meters) || 18.0,
      fuel_capacity_l: Math.round(Number(formData.fuel_capacity_l)) || 200,
      water_capacity_l: Math.round(Number(formData.water_capacity_l)) || 300,
      engine_hours_current: Number(formData.engine_hours_current) || 0,
      polar_data: {},
      created_at: isNew ? now : (await db.vessels.get(vesselId))?.created_at || now,
    };

    await db.vessels.put(record);
    await enqueueOfflineMutation({
      table_name: "vessels",
      operation: isNew ? "INSERT" : "UPDATE",
      record_id: vesselId,
      payload: record as unknown as Record<string, unknown>,
    });

    if (isNew && (!vessels || vessels.length === 0)) {
      await handleSelectActiveVessel(vesselId);
    }

    pushToast({
      title: isNew ? "Barco Creado" : "Barco Actualizado",
      subtitle: `${record.name} (${record.registration_number}) guardado en IndexedDB`,
      tone: "emerald",
    });

    setIsEditing(false);
    setFormData(EMPTY_FORM);
  };

  const handleDeleteVessel = async (vesselId: string) => {
    if (!vessels || vessels.length <= 1) {
      pushToast({
        title: "No se puede eliminar",
        subtitle: "Debe existir al menos un barco registrado en la flota",
        tone: "coral",
      });
      return;
    }

    await db.vessels.delete(vesselId);
    await enqueueOfflineMutation({
      table_name: "vessels",
      operation: "UPDATE",
      record_id: vesselId,
      payload: { deleted: true, deleted_at: new Date().toISOString() },
    });

    if (activeVesselId === vesselId) {
      const remaining = vessels.find((v) => v.id !== vesselId);
      if (remaining) {
        await handleSelectActiveVessel(remaining.id);
      }
    }

    pushToast({
      title: "Barco Eliminado",
      subtitle: "Registro eliminado de IndexedDB",
      tone: "amber",
    });
    setDeleteConfirmId(null);
  };

  const typeLabels: Record<VesselRecord["vessel_type"], string> = {
    sailboat: "Velero Monocasco",
    catamaran: "Catamarán",
    motor_yacht: "Yate a Motor",
  };

  return (
    <div data-testid="fleet-manager-view" className="space-y-6">
      {/* Header Banner */}
      <div className="marine-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Ship className="w-5 h-5 text-[var(--accent-primary)]" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Fleet &amp; Vessel Manager
            </h1>
          </div>
          <p className="text-xs sm:text-sm font-mono opacity-70 mt-1">
            Administra la flota de tu armaduría: cambia el barco activo, edita especificaciones náuticas o registra una nueva embarcación.
          </p>
        </div>

        <button
          type="button"
          data-testid="create-new-vessel-btn"
          onClick={handleOpenCreate}
          className="marine-btn marine-btn-primary text-xs sm:text-sm px-5 shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Barco</span>
        </button>
      </div>

      {/* Vessel Creation / Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-2xl marine-card p-6 sm:p-8 space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isNight
                      ? "bg-[#FF0000] text-black"
                      : "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30"
                  }`}
                >
                  <Ship className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">
                    {formData.id ? "Editar Embarcación" : "Registrar Nueva Embarcación"}
                  </h2>
                  <div className="text-xs font-mono opacity-70">
                    {formData.id ? `ID: ${formData.id}` : "Flota MarinOS"}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="w-10 min-h-14 rounded-xl border border-white/10 hover:bg-white/10 flex items-center justify-center opacity-70 hover:opacity-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVessel} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                    Nombre del Barco *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej. SV Albatros (Oceanis 41.1)"
                    className="w-full min-h-14 px-3.5 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                    Matrícula Oficial DIRECTEMAR *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.registration_number}
                    onChange={(e) =>
                      setFormData({ ...formData, registration_number: e.target.value })
                    }
                    placeholder="CB-4582"
                    className="w-full min-h-14 px-3.5 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                    Tipo de Embarcación
                  </label>
                  <select
                    value={formData.vessel_type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        vessel_type: e.target.value as VesselRecord["vessel_type"],
                      })
                    }
                    className="w-full min-h-14 px-3.5 text-sm font-medium"
                  >
                    <option value="sailboat">Velero Monocasco</option>
                    <option value="catamaran">Catamarán</option>
                    <option value="motor_yacht">Yate a Motor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                    Horómetro Motor Principal (Horas)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.engine_hours_current}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        engine_hours_current: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="1420.5"
                    className="w-full min-h-14 px-3.5 text-sm font-mono"
                  />
                </div>
              </div>

              {/* Dimensions Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                    Eslora LOA (m)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.loa_meters}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        loa_meters: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="12.43"
                    className="w-full min-h-14 px-3.5 text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                    Manga (m)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.beam_meters}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        beam_meters: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="4.20"
                    className="w-full min-h-14 px-3.5 text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                    Calado (m)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.draft_meters}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        draft_meters: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="2.18"
                    className="w-full min-h-14 px-3.5 text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                    Mástil (m)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.mast_height_meters}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        mast_height_meters: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="18.50"
                    className="w-full min-h-14 px-3.5 text-sm font-mono"
                  />
                </div>
              </div>

              {/* Tank Capacities */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                    Capacidad Diésel (Litros)
                  </label>
                  <input
                    type="number"
                    value={formData.fuel_capacity_l}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        fuel_capacity_l: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    placeholder="200"
                    className="w-full min-h-14 px-3.5 text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                    Capacidad Agua Dulce (Litros)
                  </label>
                  <input
                    type="number"
                    value={formData.water_capacity_l}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        water_capacity_l: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    placeholder="330"
                    className="w-full min-h-14 px-3.5 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 flex flex-wrap items-center justify-end gap-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="marine-btn marine-btn-secondary text-xs sm:text-sm px-4"
                >
                  <span>Cancelar</span>
                </button>
                <button
                  type="submit"
                  data-testid="save-vessel-submit-btn"
                  className="marine-btn marine-btn-primary text-xs sm:text-sm px-6"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar Barco en IndexedDB</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fleet Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {vessels?.map((v) => {
          const isActive = v.id === activeVesselId;
          const isConfirmingDelete = deleteConfirmId === v.id;

          return (
            <div
              key={v.id}
              data-testid={`fleet-vessel-card-${v.id}`}
              className={`marine-card p-6 flex flex-col justify-between space-y-5 transition-all ${
                isActive
                  ? isNight
                    ? "border-[#FF0000] shadow-[0_0_24px_rgba(255,0,0,0.3)]"
                    : "border-[var(--accent-primary)] shadow-[0_4px_30px_rgba(255,87,34,0.2)]"
                  : ""
              }`}
            >
              <div className="space-y-4">
                {/* Card Header */}
                <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                        isActive
                          ? isNight
                            ? "bg-[#FF0000] text-black"
                            : "bg-[var(--accent-primary)] text-white shadow-lg"
                          : "bg-white/5 border border-white/10"
                      }`}
                    >
                      <Ship className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold tracking-tight">{v.name}</h2>
                        {isActive && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold mo-tint-ok">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>ACTIVO</span>
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-mono opacity-70">
                        {v.registration_number} • {typeLabels[v.vessel_type]}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      data-testid={`edit-vessel-${v.id}`}
                      onClick={() => handleOpenEdit(v)}
                      title="Editar especificaciones"
                      className="w-10 min-h-14 rounded-xl border border-white/10 hover:bg-white/10 flex items-center justify-center text-xs opacity-75 hover:opacity-100"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      data-testid={`delete-vessel-${v.id}`}
                      onClick={() => setDeleteConfirmId(v.id)}
                      title="Eliminar barco"
                      className="w-10 min-h-14 rounded-xl border border-white/10 hover:bg-[#FF2D55]/20 flex items-center justify-center text-xs opacity-75 hover:opacity-100 text-[#FF2D55]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Delete Confirmation Inline Banner */}
                {isConfirmingDelete && (
                  <div className="p-3.5 rounded-xl mo-tint-danger text-xs space-y-2">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      <span>¿Confirmar eliminación de {v.name}?</span>
                    </div>
                    <p className="text-[11px] opacity-85">
                      Esta acción eliminará el barco de IndexedDB. Se recomienda mantener al menos una nave registrada.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleDeleteVessel(v.id)}
                        className="px-3 py-1.5 rounded-lg bg-[#FF2D55] text-white font-bold text-xs"
                      >
                        Sí, Eliminar
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-3 py-1.5 rounded-lg bg-white/10 text-xs"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* Specs Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 font-mono text-xs">
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                    <div className="text-[10px] opacity-60 flex items-center gap-1">
                      <Ruler className="w-3 h-3" />
                      <span>ESLORA / MANGA</span>
                    </div>
                    <div className="font-semibold mt-1">
                      {v.loa_meters}m × {v.beam_meters}m
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                    <div className="text-[10px] opacity-60 flex items-center gap-1">
                      <Anchor className="w-3 h-3" />
                      <span>CALADO MÁX</span>
                    </div>
                    <div className="font-semibold mt-1 text-[var(--accent-primary)]">
                      {v.draft_meters}m
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                    <div className="text-[10px] opacity-60 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>HORÓMETRO</span>
                    </div>
                    <div className="font-semibold mt-1">{v.engine_hours_current} hrs</div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                    <div className="text-[10px] opacity-60 flex items-center gap-1">
                      <Fuel className="w-3 h-3 text-[#FF9F0A]" />
                      <span>ESTANQUE DIÉSEL</span>
                    </div>
                    <div className="font-semibold mt-1">{v.fuel_capacity_l} L</div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                    <div className="text-[10px] opacity-60 flex items-center gap-1">
                      <Droplets className="w-3 h-3 text-[#00E5FF]" />
                      <span>AGUA DULCE</span>
                    </div>
                    <div className="font-semibold mt-1">{v.water_capacity_l} L</div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                    <div className="text-[10px] opacity-60 flex items-center gap-1">
                      <Compass className="w-3 h-3" />
                      <span>MÁSTIL (AIRE)</span>
                    </div>
                    <div className="font-semibold mt-1">{v.mast_height_meters}m</div>
                  </div>
                </div>
              </div>

              {/* Action Bottom */}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                <span className="text-[11px] font-mono opacity-60">
                  {v.org_id === DEMO_IDS.ORG_ID ? "Flota Principal" : "Embarcación Externa"}
                </span>

                {!isActive && (
                  <button
                    type="button"
                    data-testid={`activate-vessel-${v.id}`}
                    onClick={() => handleSelectActiveVessel(v.id)}
                    className="marine-btn marine-btn-secondary text-xs px-4"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#00E676]" />
                    <span>Establecer como Barco Activo</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
