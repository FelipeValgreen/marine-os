"use client";

import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Users,
  UserPlus,
  Search,
  Calendar,
  Phone,
  Mail,
  Trash2,
  Edit2,
  Send,
  X,
  Save,
  CheckCircle2,
} from "lucide-react";
import {
  db,
  DEMO_IDS,
  enqueueOfflineMutation,
  crewContactIdFor,
  type CrewContactRecord,
  type VoyageCrewRecord,
} from "@/lib/offline/db";
import { evaluateLicenseSemaphore } from "@/lib/licenses";
import { useMarineContext } from "@/components/ThemeProvider";

export function CrewDirectory({
  onInjectToVoyage,
}: {
  onInjectToVoyage?: (crew: CrewContactRecord) => void;
}) {
  const { pushToast, setActiveSection } = useMarineContext();

  const contacts = useLiveQuery(
    async () => {
      const freq = db.frequent_crew
        ? await db.frequent_crew.orderBy("full_name").toArray()
        : [];
      if (freq && freq.length > 0) return freq;
      return db.crew_contacts.orderBy("full_name").toArray();
    },
    [],
    []
  );

  const activeVoyage = useLiveQuery(
    () => db.voyages.where("status").equals("checkin_pending").first() || db.voyages.get(DEMO_IDS.VOYAGE_ID),
    []
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "skipper" | "crew" | "guest">("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<Omit<CrewContactRecord, "id" | "voyages_count" | "created_at" | "updated_at">>({
    full_name: "",
    document_type: "RUT",
    document_number: "",
    nationality: "CL",
    default_role: "crew",
    license_type: "Patrón Deportivo de Bahía (DIRECTEMAR)",
    license_expiry: "2029-12-31",
    phone: "",
    email: "",
    notes: "",
    ocr_verified: true,
  });

  const handleOpenNew = () => {
    setEditingId(null);
    setFormData({
      full_name: "",
      document_type: "RUT",
      document_number: "",
      nationality: "CL",
      default_role: "crew",
      license_type: "Patrón Deportivo de Bahía (DIRECTEMAR)",
      license_expiry: "2029-12-31",
      phone: "",
      email: "",
      notes: "",
      ocr_verified: false,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (contact: CrewContactRecord) => {
    setEditingId(contact.id);
    setFormData({
      full_name: contact.full_name,
      document_type: contact.document_type,
      document_number: contact.document_number,
      nationality: contact.nationality,
      default_role: contact.default_role,
      license_type: contact.license_type || "",
      license_expiry: contact.license_expiry || "",
      phone: contact.phone || "",
      email: contact.email || "",
      notes: contact.notes || "",
      ocr_verified: Boolean(contact.ocr_verified),
    });
    setIsModalOpen(true);
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name.trim() || !formData.document_number.trim()) {
      pushToast({
        title: "Campos Requeridos",
        subtitle: "Nombre y Número de documento son obligatorios",
        tone: "coral",
      });
      return;
    }

    const id = editingId || crewContactIdFor(formData.document_number);
    const now = new Date().toISOString();
    const existing = await db.crew_contacts.get(id);

    const record: CrewContactRecord = {
      id,
      full_name: formData.full_name.trim(),
      document_type: formData.document_type,
      document_number: formData.document_number.trim(),
      nationality: formData.nationality.trim().toUpperCase(),
      default_role: formData.default_role,
      license_type: formData.license_type?.trim() || undefined,
      license_expiry: formData.license_expiry || undefined,
      phone: formData.phone?.trim() || undefined,
      email: formData.email?.trim() || undefined,
      notes: formData.notes?.trim() || undefined,
      ocr_verified: formData.ocr_verified,
      voyages_count: existing?.voyages_count ?? 0,
      last_embarked_at: existing?.last_embarked_at,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };

    await db.crew_contacts.put(record);
    if (db.frequent_crew) {
      await db.frequent_crew.put(record);
    }
    await enqueueOfflineMutation({
      table_name: "frequent_crew",
      operation: "UPSERT",
      record_id: id,
      payload: record as unknown as Record<string, unknown>,
    });

    pushToast({
      title: editingId ? "Tripulante Actualizado" : "Tripulante Guardado en Libreta",
      subtitle: `${record.full_name} (${record.document_number})`,
      tone: "emerald",
    });

    setIsModalOpen(false);
  };

  const handleDeleteContact = async (id: string) => {
    await db.crew_contacts.delete(id);
    if (db.frequent_crew) {
      await db.frequent_crew.delete(id);
    }
    await enqueueOfflineMutation({
      table_name: "frequent_crew",
      operation: "UPDATE",
      record_id: id,
      payload: { deleted: true, deleted_at: new Date().toISOString() },
    });
    pushToast({
      title: "Contacto Eliminado",
      subtitle: "Registro removido de la libreta local",
      tone: "amber",
    });
  };

  const handleInjectIntoVoyage = async (contact: CrewContactRecord) => {
    if (onInjectToVoyage) {
      onInjectToVoyage(contact);
      return;
    }

    const voyageId = activeVoyage?.id || DEMO_IDS.VOYAGE_ID;
    const existingInVoyage = await db.voyage_crew
      .where("voyage_id")
      .equals(voyageId)
      .and((c) => c.document_number === contact.document_number)
      .first();

    if (existingInVoyage) {
      pushToast({
        title: "Ya Inscrito en el Zarpe",
        subtitle: `${contact.full_name} ya figura en el rol de la travesía activa`,
        tone: "amber",
      });
      setActiveSection("voyages");
      return;
    }

    const now = new Date().toISOString();
    const newVoyageMember: VoyageCrewRecord = {
      id: `crew-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      voyage_id: voyageId,
      role: contact.default_role,
      full_name: contact.full_name,
      document_type: contact.document_type,
      document_number: contact.document_number,
      nationality: contact.nationality,
      license_type: contact.license_type,
      license_expiry: contact.license_expiry,
      ocr_verified: Boolean(contact.ocr_verified),
      waiver_signed_at: now,
      created_at: now,
    };

    await db.voyage_crew.put(newVoyageMember);
    await enqueueOfflineMutation({
      table_name: "voyage_crew",
      operation: "INSERT",
      record_id: newVoyageMember.id,
      payload: newVoyageMember as unknown as Record<string, unknown>,
    });

    // Update voyage count in address book
    await db.crew_contacts.update(contact.id, {
      voyages_count: (contact.voyages_count || 0) + 1,
      last_embarked_at: now,
      updated_at: now,
    });

    pushToast({
      title: "Tripulante Inyectado al E-Zarpe",
      subtitle: `${contact.full_name} agregado al Rol de Tripulación sin re-escanear`,
      tone: "emerald",
    });

    setActiveSection("voyages");
  };

  const filteredContacts = (contacts || []).filter((c) => {
    if (roleFilter !== "all" && c.default_role !== roleFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.full_name.toLowerCase().includes(q) ||
      c.document_number.toLowerCase().includes(q) ||
      c.license_type?.toLowerCase().includes(q) ||
      c.nationality.toLowerCase().includes(q)
    );
  });

  return (
    <div data-testid="crew-directory-view" className="space-y-6">
      {/* Header Banner */}
      <div className="marine-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[var(--accent-primary)]" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Crew Directory • Libreta de Tripulación Frecuente
            </h1>
          </div>
          <p className="text-xs sm:text-sm font-mono opacity-70 mt-1">
            Historial de navegantes frecuentes, control de licencias DIRECTEMAR y enrolamiento rápido en 1-clic para e-Zarpes.
          </p>
        </div>

        <button
          type="button"
          data-testid="add-crew-contact-btn"
          onClick={handleOpenNew}
          className="marine-btn marine-btn-primary text-xs sm:text-sm px-5 shrink-0 self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Nuevo Tripulante</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="marine-card p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, RUT o licencia..."
            className="w-full pl-10 pr-3.5 text-xs sm:text-sm"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(["all", "skipper", "crew", "guest"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition ${
                roleFilter === r
                  ? "bg-[#1a2332] text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)] font-bold shadow-none"
                  : "bg-white/[0.03] text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] opacity-70"
              }`}
            >
              {r === "all" ? "Todos" : r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Contacts List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredContacts.length === 0 ? (
          <div className="col-span-full marine-card p-8 text-center space-y-3">
            <Users className="w-10 h-10 mx-auto opacity-30 text-[var(--accent-primary)]" />
            <h3 className="text-base font-semibold">No se encontraron tripulantes en la libreta</h3>
            <p className="text-xs font-mono opacity-60 max-w-md mx-auto">
              Guarda tripulantes al escanearlos en la vista de e-Zarpe o haz clic en &quot;Nuevo Tripulante&quot; para agregarlos manualmente.
            </p>
          </div>
        ) : (
          filteredContacts.map((contact) => {
            const semaphore = evaluateLicenseSemaphore(contact.license_expiry);

            return (
              <div
                key={contact.id}
                data-testid={`crew-card-${contact.id}`}
                className="marine-card p-5 flex flex-col justify-between space-y-4 hover:border-white/25 transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2 border-b border-white/5 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] font-bold">
                          {contact.default_role}
                        </span>
                        {contact.ocr_verified && (
                          <span className="text-[10px] font-mono text-[#00E676] inline-flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>OCR</span>
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold tracking-tight mt-1">
                        {contact.full_name}
                      </h3>
                      <div className="text-xs font-mono opacity-65">
                        {contact.document_type}: {contact.document_number} ({contact.nationality})
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(contact)}
                        className="w-9 h-9 rounded-lg hover:bg-white/10 flex items-center justify-center opacity-70 hover:opacity-100"
                        title="Editar tripulante"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteContact(contact.id)}
                        className="w-9 h-9 rounded-lg hover:bg-[#FF2D55]/20 flex items-center justify-center opacity-70 hover:opacity-100 text-[#FF2D55]"
                        title="Eliminar de la libreta"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* License and Semaphore Info */}
                  <div className="space-y-1.5 font-mono text-xs">
                    <div className="flex items-center justify-between">
                      <span className="opacity-60 text-[11px]">LICENCIA DIRECTEMAR:</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          semaphore.tone === "green"
                            ? "mo-tint-ok"
                            : semaphore.tone === "amber"
                            ? "mo-tint-warn"
                            : "mo-tint-danger"
                        }`}
                      >
                        {semaphore.label}
                      </span>
                    </div>
                    <div className="font-semibold truncate">
                      {contact.license_type || "Tripulante / Sin Licencia Náutica"}
                    </div>
                    {contact.license_expiry && (
                      <div className="text-[11px] opacity-65 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>Vencimiento: {contact.license_expiry}</span>
                      </div>
                    )}
                  </div>

                  {(contact.phone || contact.email) && (
                    <div className="pt-2 border-t border-white/5 text-[11px] font-mono opacity-70 space-y-0.5">
                      {contact.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-[var(--accent-primary)]" />
                          <span>{contact.phone}</span>
                        </div>
                      )}
                      {contact.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3 h-3 text-[var(--accent-primary)]" />
                          <span className="truncate">{contact.email}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Inject into Zarpe CTA */}
                <button
                  type="button"
                  data-testid={`inject-crew-btn-${contact.id}`}
                  onClick={() => handleInjectIntoVoyage(contact)}
                  className="w-full marine-btn marine-btn-primary text-xs font-semibold"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Inyectar en E-Zarpe Activo</span>
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-xl marine-card p-6 sm:p-8 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h2 className="text-lg font-bold">
                {editingId ? "Editar Tripulante" : "Registrar en Libreta de Tripulación"}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-10 h-10 rounded-xl hover:bg-white/10 flex items-center justify-center opacity-70 hover:opacity-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Ej. Sophie Laurent Moreau"
                  className="w-full min-h-14 px-3.5 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                    Tipo Doc.
                  </label>
                  <select
                    value={formData.document_type}
                    onChange={(e) => setFormData({ ...formData, document_type: e.target.value })}
                    className="w-full min-h-14 px-3.5 text-sm font-mono"
                  >
                    <option value="RUT">RUT (CL)</option>
                    <option value="PASSPORT">Pasaporte</option>
                    <option value="DNI">DNI</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                    Nº Documento *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.document_number}
                    onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                    placeholder="16.781.234-K"
                    className="w-full min-h-14 px-3.5 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                    Nacionalidad
                  </label>
                  <input
                    type="text"
                    value={formData.nationality}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                    placeholder="CL"
                    className="w-full min-h-14 px-3.5 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                    Rol Habitual
                  </label>
                  <select
                    value={formData.default_role}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        default_role: e.target.value as "skipper" | "crew" | "guest",
                      })
                    }
                    className="w-full min-h-14 px-3.5 text-sm font-medium"
                  >
                    <option value="skipper">Skipper / Patrón</option>
                    <option value="crew">Crew / Tripulante</option>
                    <option value="guest">Guest / Pasajero</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                    Vencimiento Licencia
                  </label>
                  <input
                    type="date"
                    value={formData.license_expiry || ""}
                    onChange={(e) => setFormData({ ...formData, license_expiry: e.target.value })}
                    className="w-full min-h-14 px-3.5 text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                  Licencia Náutica Deportiva DIRECTEMAR
                </label>
                <input
                  type="text"
                  value={formData.license_type || ""}
                  onChange={(e) => setFormData({ ...formData, license_type: e.target.value })}
                  placeholder="Capitán Deportivo Costero (DIRECTEMAR)"
                  className="w-full min-h-14 px-3.5 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                    Teléfono Contacto
                  </label>
                  <input
                    type="text"
                    value={formData.phone || ""}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+56 9 1234 5678"
                    className="w-full min-h-14 px-3.5 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono uppercase opacity-70 mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="tripulante@austral.cl"
                    className="w-full min-h-14 px-3.5 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="marine-btn marine-btn-secondary text-xs sm:text-sm px-4"
                >
                  <span>Cancelar</span>
                </button>
                <button
                  type="submit"
                  className="marine-btn marine-btn-primary text-xs sm:text-sm px-6"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar en Libreta</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
