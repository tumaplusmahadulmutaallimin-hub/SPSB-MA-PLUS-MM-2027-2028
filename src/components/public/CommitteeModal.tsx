import React from 'react';
import { X, MessageCircle, Phone, Sparkles, CheckCircle2, ShieldCheck } from 'lucide-react';
import { CommitteeContact } from '../../types';

interface CommitteeModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: CommitteeContact[];
  institutionName: string;
}

export const CommitteeModal: React.FC<CommitteeModalProps> = ({
  isOpen,
  onClose,
  contacts,
  institutionName,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl relative border border-slate-100 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-800 mx-auto mb-3 shadow-xs">
          <MessageCircle className="w-6 h-6 text-emerald-600" />
        </div>

        <div className="text-center mb-6">
          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            Layanan Resmi
          </span>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 mt-1.5">
            Saluran WhatsApp Resmi & Kontak Panitia
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Hubungi langsung person in charge (panitia) {institutionName} sesuai dengan kebutuhan informasi Anda.
          </p>
        </div>

        <div className="space-y-3">
          {contacts.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500 space-y-2">
              <p className="font-semibold text-slate-700">
                Belum ada kontak person panitia yang ditambahkan oleh Administrator.
              </p>
              <p className="text-[11px] text-slate-400">
                Silakan hubungi bagian tata usaha atau tunggu pembaruan daftar narahubung resmi madrasah.
              </p>
            </div>
          ) : (
            contacts.map((contact) => {
              const cleanNumber = contact.whatsappNumber.replace(/[^0-9]/g, '');
              const waUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(
                `Assalamu'alaikum, saya ingin berkonsultasi mengenai informasi ${contact.role} di ${institutionName}.`
              )}`;

              return (
                <div
                  key={contact.id}
                  className="bg-slate-50 hover:bg-emerald-50/50 p-4 rounded-2xl border border-slate-200 hover:border-emerald-300 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                      <Phone className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
                        <span>{contact.name}</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      </h4>
                      <span className="text-xs font-semibold text-emerald-700 block">
                        {contact.role}
                      </span>
                      {contact.notes && (
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          {contact.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all cursor-pointer whitespace-nowrap"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Chat WhatsApp</span>
                  </a>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Nomor kontak panitia terverifikasi oleh madrasah</span>
          </div>
          <button
            onClick={onClose}
            className="font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
