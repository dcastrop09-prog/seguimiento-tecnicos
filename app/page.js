'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [tecnicos, setTecnicos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [plantillas, setPlantillas] = useState([]);
  
  const [tecnicoSel, setTecnicoSel] = useState('');
  const [clienteSel, setClienteSel] = useState('');
  const [plantillaSel, setPlantillaSel] = useState('');
  const [comentario, setComentario] = useState('');

  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState('');
  const [errorCarga, setErrorCarga] = useState('');

  useEffect(() => {
    async function cargarCatalogos() {
      try {
        setCargando(true);
        setErrorCarga('');

        // Cargar Técnicos
        const { data: dataTec, error: errTec } = await supabase
          .from('tecnicos')
          .select('*');

        if (errTec) throw new Error(`Técnicos: ${errTec.message}`);
        if (dataTec) setTecnicos(dataTec);

        // Cargar Clientes
        const { data: dataCli, error: errCli } = await supabase
          .from('clientes')
          .select('*');

        if (errCli) throw new Error(`Clientes: ${errCli.message}`);
        if (dataCli) setClientes(dataCli);

        // Cargar Plantillas
        const { data: dataPla, error: errPla } = await supabase
          .from('plantillas')
          .select('*');

        if (errPla) throw new Error(`Plantillas: ${errPla.message}`);
        if (dataPla) setPlantillas(dataPla);

      } catch (err) {
        console.error('Error cargando catálogos:', err);
        setErrorCarga(err.message || 'Error al conectar con la base de datos.');
      } finally {
        setCargando(false);
      }
    }

    cargarCatalogos();
  }, []);

  const handleRegistrar = async (e) => {
    e.preventDefault();
    setMensaje('');

    if (!tecnicoSel || !clienteSel || !plantillaSel) {
      alert('Por favor selecciona Técnico, Cliente y Plantilla.');
      return;
    }

    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        const { error } = await supabase.from('registros_actividad').insert([
          {
            tecnico_id: tecnicoSel,
            cliente_id: clienteSel,
            plantilla_id: plantillaSel,
            latitud_registro: latitude,
            longitud_registro: longitude,
            comentario_alerta: comentario,
            estado: 'En Progreso'
          }
        ]);

        if (error) {
          setMensaje(`Error al registrar: ${error.message}`);
        } else {
          setMensaje('¡Inicio de mantenimiento registrado con éxito!');
          setTecnicoSel('');
          setClienteSel('');
          setPlantillaSel('');
          setComentario('');
        }
      },
      (error) => {
        alert('No se pudo obtener la ubicación GPS. Verifica los permisos.');
      },
      { enableHighAccuracy: true }
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans flex flex-col justify-center items-center">
      <div className="bg-white p-6 rounded-2xl shadow-md w-full max-w-md border border-slate-200 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 text-center">
            Registro de Visita Técnica
          </h1>
          <p className="text-slate-500 text-xs text-center mt-1">
            Aguialarmas Ltda. - Control de Campo
          </p>
        </div>

        {errorCarga && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg">
            <strong>Error de conexión:</strong> {errorCarga}
          </div>
        )}

        {cargando ? (
          <div className="text-center py-6 text-slate-500 text-sm animate-pulse">
            Cargando opciones desde el servidor...
          </div>
        ) : (
          <form onSubmit={handleRegistrar} className="space-y-4 text-xs font-semibold text-slate-700">
            {/* Técnico */}
            <div>
              <label className="block mb-1">Técnico:</label>
              <select
                value={tecnicoSel}
                onChange={(e) => setTecnicoSel(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-normal focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">-- Seleccionar Técnico --</option>
                {tecnicos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre || t.nombre_tecnico || `Técnico #${t.id}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Cliente */}
            <div>
              <label className="block mb-1">Cliente:</label>
              <select
                value={clienteSel}
                onChange={(e) => setClienteSel(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-normal focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">-- Seleccionar Cliente --</option>
                {clientes.map((c) => (
                  <option key={c.id || c.id_cliente} value={c.id || c.id_cliente}>
                    {c.nombre || c.nombre_cliente || `Cliente #${c.id || c.id_cliente}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Plantilla */}
            <div>
              <label className="block mb-1">Plantilla / Trabajo:</label>
              <select
                value={plantillaSel}
                onChange={(e) => setPlantillaSel(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-normal focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">-- Seleccionar Plantilla --</option>
                {plantillas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre || p.nombre_plantilla || `Plantilla #${p.id}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Comentario */}
            <div>
              <label className="block mb-1">Comentario u Observación (Opcional):</label>
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Escribe alguna observación previa..."
                rows={3}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-normal focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition shadow-md text-sm mt-2"
            >
              Registrar Inicio Mantenimiento
            </button>
          </form>
        )}

        {mensaje && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-lg text-center font-semibold">
            {mensaje}
          </div>
        )}
      </div>
    </div>
  );
}