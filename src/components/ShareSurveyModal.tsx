import React, { useRef, useState } from 'react';
import { Check, Copy, Download, ExternalLink, QrCode, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { Survey } from '../types';

interface ShareSurveyModalProps {
  survey: Survey;
  onClose: () => void;
  onOpenGuestPreview: (survey: Survey) => void;
}

export function ShareSurveyModal({
  survey,
  onClose,
  onOpenGuestPreview,
}: ShareSurveyModalProps) {
  const [copied, setCopied] = useState(false);
  const qrWrapperRef = useRef<HTMLDivElement | null>(null);

  const publicUrl = `${window.location.origin}/?encuesta=${encodeURIComponent(survey.id)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback selection copy
      const input = document.createElement('input');
      input.value = publicUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadQrSvg = () => {
    const svg = qrWrapperRef.current?.querySelector('svg');
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `qr_${survey.hotelName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 id="share-modal-title" className="text-base font-bold text-slate-900">
              Compartir encuesta online
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Acceso directo para huéspedes sin registro obligatorio
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {survey.status !== 'active' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              Esta encuesta está pausada actualmente. Actívala para que los huéspedes puedan abrir
              el enlace y enviar respuestas.
            </div>
          )}

          {/* Direct URL */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700">
              Enlace directo para enviar por WhatsApp, correo o check-out
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={publicUrl}
                className="flex-1 h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-mono text-slate-700 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3.5 h-10 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>

          {/* QR Code for Reception / Rooms */}
          <div className="border-t border-slate-100 pt-6 flex flex-col sm:flex-row items-center gap-6">
            <div
              ref={qrWrapperRef}
              className="p-4 bg-white border border-slate-200 rounded-xl shrink-0"
            >
              <QRCodeSVG value={publicUrl} size={144} level="M" fgColor="#0F172A" />
            </div>
            <div className="space-y-3 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 text-slate-900">
                <QrCode className="w-4 h-4 text-teal-700" />
                <h3 className="text-sm font-semibold">Código QR para recepción y habitaciones</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Imprime este código para tarjetas de mesilla, mostrador de recepción o facturas de
                check-out. El huésped escanea y contesta al instante.
              </p>
              <button
                type="button"
                onClick={handleDownloadQrSvg}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar QR (SVG)
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenGuestPreview(survey);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-800 hover:text-teal-950 transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Probar encuesta como huésped ahora
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
