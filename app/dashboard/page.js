'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function Dashboard() {
  const [registros, setRegistros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargarRegistros = async () => {
    try {
      setCargando(true);
      setError('');

      const { data, error: err } = await supabase
        .from('registros_actividad')
        .select(`
          id,
          created_at,
          fecha_fin,
          estado,
          comentario_alerta,
          latitud_registro,
          longitud_registro,
          tecnicos ( nombre ),
          clientes ( nombre ),
          plantillas ( nombre )
        `)
        .order('created_at', { ascending: false });

      if (err) throw err;

      setRegistros(data || []);
    } catch (err) {
      console.error('Error cargando el dashboard:', err);
      setError(err.message || 'Error al conectar con la base de datos.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarRegistros();
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Cabecera */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Dashboard de Control de Campo
            </h1>
            <p className="text-slate-500 text-xs mt-1">
              Aguialarmas Ltda. - Registros de Visitas y Mantenimiento
            </p>
          </div>
          <div className="mt-4 md:mt-0 flex gap-3">
            <button
              onClick={cargarRegistros}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition"
            >
              Actualizar Datos
            </button>
            <a
              href="/"
              className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition inline-flex items-center"
            >
              Ir al Formulario
            </a>
          </div>
        </div>

        {/* Mensaje de Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-4 rounded-xl">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Tabla de Registros */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {cargando ? (
            <div className="p-8 text-center text-slate-400 text-sm animate-pulse">
              Cargando registros de actividad...
            </div>
          ) : registros.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No hay registros de actividad guardados aún.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-800 uppercase font-semibold">
                  <tr>
                    <th className="p-4">Fecha / Hora</th>
                    <th className="p-4">Técnico</th>
                    <th className="p-4">Cliente</th>
                    <th className="p-4">Plantilla / Trabajo</th>
                    <th className="p-4">Estado</th>
                    <th className="p-4">Ubicación GPS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {registros.map((reg) => (
                    <tr key={reg.id} className="hover:bg-slate-50 transition">
                      <td className="p-4 whitespace-nowrap">
                        {reg.created_at
                          ? new Date(reg.created_at).toLocaleString('es-CO')
                          : 'N/A'}
                      </td>
                      <td className="p-4 font-medium text-slate-900">
                        {reg.tecnicos?.nombre || 'N/A'}
                      </td>
                      <td className="p-4">
                        {reg.clientes?.nombre || 'N/A'}
                      </td>
                      <td className="p-4">
                        {reg.plantillas?.nombre || 'N/A'}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            reg.estado === 'Finalizado'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {reg.estado || 'En Progreso'}
                        </span>
                      </td>
                      <td className="p-4 whitespace-nowrap text-slate-500">
                        {reg.latitud_registro && reg.longitud_registro ? (
                          <a
                            href={`https://maps.google.com/?q=${reg.latitud_registro},${reg.longitud_registro}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline font-medium"
                          >
                            Ver en Mapas
                          </a>
                        ) : (
                          'Sin GPS'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}