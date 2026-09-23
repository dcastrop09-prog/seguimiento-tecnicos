'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// Función para calcular la distancia en metros entre dos coordenadas (Fórmula de Haversine)
function calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return null;
  const R = 6371000; // Radio de la Tierra en metros
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function Home() {
  const [tecnicos, setTecnicos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [plantillas, setPlantillas] = useState([]);

  const [tecnicoSel, setTecnicoSel] = useState('');
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [clienteSel, setClienteSel] = useState('');
  const [plantillaSel, setPlantillaSel] = useState('');
  const [tiempoEst, setTiempoEst] = useState(0);

  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });

  // Cargar catálogos al iniciar la pantalla
  useEffect(() => {
    async function cargarCatalogos() {
      try {
        setCargando(true);
        const [{ data: dataTec }, { data: dataCli }, { data: dataPla }] = await Promise.all([
          supabase.from('tecnicos').select('*'),
          supabase.from('clientes').select('*'),
          supabase.from('plantillas').select('*')
        ]);

        if (dataTec) setTecnicos(dataTec);
        if (dataCli) setClientes(dataCli);
        if (dataPla) setPlantillas(dataPla);
      } catch (err) {
        setMensaje({ tipo: 'error', texto: 'Error cargando datos desde Supabase.' });
      } finally {
        setCargando(false);
      }
    }
    cargarCatalogos();
  }, []);

  // Filtrar lista de clientes según la búsqueda ingresada
  const clientesFiltrados = clientes.filter((c) => {
    const nombre = c.nombre || c.nombre_cliente || '';
    return nombre.toLowerCase().includes(busquedaCliente.toLowerCase());
  });

  // Al seleccionar plantilla, obtener y mostrar su tiempo estimado
  const handlePlantillaChange = (e) => {
    const pId = e.target.value;
    setPlantillaSel(pId);
    const pEncontrada = plantillas.find((p) => String(p.id) === String(pId));
    if (pEncontrada) {
      setTiempoEst(pEncontrada.tiempo_estimado || pEncontrada.duracion_minutos || pEncontrada.tiempo || 30);
    } else {
      setTiempoEst(0);
    }
  };

  // Registrar Inicio Mantenimiento con validación de geofencing (20 metros)
  const handleInicioMantenimiento = () => {
    setMensaje({ tipo: '', texto: '' });

    if (!tecnicoSel || !clienteSel || !plantillaSel) {
      setMensaje({ tipo: 'error', texto: 'Debes seleccionar Técnico, Cliente y Plantilla.' });
      return;
    }

    if (!navigator.geolocation) {
      setMensaje({ tipo: 'error', texto: 'Tu dispositivo no soporta geolocalización GPS.' });
      return;
    }

    const clienteObj = clientes.find((c) => String(c.id || c.id_cliente) === String(clienteSel));

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: latTec, longitude: lonTec } = position.coords;

        const latCli = clienteObj?.latitud !== undefined ? clienteObj.latitud : clienteObj?.latitud_cliente;
        const lonCli = clienteObj?.longitud !== undefined ? clienteObj.longitud : clienteObj?.longitud_cliente;

        // Validar geofencing de 20 metros si el cliente tiene coordenadas registradas
        if (latCli !== null && latCli !== undefined && lonCli !== null && lonCli !== undefined) {
          const distancia = calcularDistanciaMetros(latTec, lonTec, Number(latCli), Number(lonCli));
          if (distancia !== null && distancia > 50) {
            setMensaje({
              tipo: 'error',
              texto: `No te encuentras en el sitio del cliente. Distancia actual: ${Math.round(distancia)}m (Máximo permitido: 20m).`
            });
            return;
          }
        }

        // Insertar registro de inicio en la base de datos
        const { error } = await supabase.from('registros_actividad').insert([
          {
            tecnico_id: tecnicoSel,
            cliente_id: clienteSel,
            plantilla_id: plantillaSel,
            latitud_registro: latTec,
            longitud_registro: lonTec,
            latitud: latTec,
            longitud: lonTec,
            estado: 'En Mantenimiento'
          }
        ]);

        if (error) {
          setMensaje({ tipo: 'error', texto: `Error al registrar: ${error.message}` });
        } else {
          setMensaje({ tipo: 'exito', texto: '¡Inicio de mantenimiento registrado con éxito!' });
        }
      },
      (err) => {
        setMensaje({ tipo: 'error', texto: 'No se pudo obtener la ubicación GPS. Activa el GPS y concede permisos.' });
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  // Registrar Fin Mantenimiento
  const handleFinMantenimiento = async () => {
    setMensaje({ tipo: '', texto: '' });

    if (!tecnicoSel || !clienteSel) {
      setMensaje({ tipo: 'error', texto: 'Selecciona Técnico y Cliente para registrar el fin.' });
      return;
    }

    const { error } = await supabase
      .from('registros_actividad')
      .update({ estado: 'Finalizado', fecha_fin: new Date().toISOString() })
      .eq('tecnico_id', tecnicoSel)
      .eq('cliente_id', clienteSel)
      .eq('estado', 'En Mantenimiento');

    if (error) {
      setMensaje({ tipo: 'error', texto: `Error al finalizar: ${error.message}` });
    } else {
      setMensaje({ tipo: 'exito', texto: '¡Mantenimiento finalizado con éxito!' });
    }
  };

  // Finalizar Jornada
  const handleFinalizarJornada = () => {
    setTecnicoSel('');
    setClienteSel('');
    setPlantillaSel('');
    setBusquedaCliente('');
    setTiempoEst(0);
    setMensaje({ tipo: 'exito', texto: 'Jornada finalizada correctamente.' });
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 font-sans flex flex-col justify-center items-center">
      <div className="bg-white p-6 rounded-2xl shadow-sm w-full max-w-sm border border-slate-200 space-y-4">
        
        <h1 className="text-xl font-bold text-slate-800 text-center">
          Registro de Actividad
        </h1>

        {cargando ? (
          <div className="text-center py-8 text-slate-400 text-xs">Cargando opciones...</div>
        ) : (
          <div className="space-y-4 text-xs font-semibold text-slate-700">
            {/* Técnico */}
            <div>
              <label className="block mb-1 text-slate-800">Técnico:</label>
              <select
                value={tecnicoSel}
                onChange={(e) => setTecnicoSel(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-normal focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- Seleccione un técnico --</option>
                {tecnicos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre || t.nombre_tecnico}
                  </option>
                ))}
              </select>
            </div>

            {/* Buscar Cliente */}
            <div>
              <label className="block mb-1 text-slate-800">Buscar Cliente:</label>
              <input
                type="text"
                placeholder="Escriba para buscar..."
                value={busquedaCliente}
                onChange={(e) => setBusquedaCliente(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-normal focus:outline-none focus:ring-1 focus:ring-blue-500 mb-1"
              />
              <select
                value={clienteSel}
                onChange={(e) => setClienteSel(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-normal focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- Seleccione un cliente --</option>
                {clientesFiltrados.map((c) => (
                  <option key={c.id || c.id_cliente} value={c.id || c.id_cliente}>
                    {c.nombre || c.nombre_cliente}
                  </option>
                ))}
              </select>
            </div>

            {/* Plantilla y Tiempo Estimado */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
              <div>
                <label className="block mb-1 text-slate-800">Plantilla(s):</label>
                <select
                  value={plantillaSel}
                  onChange={handlePlantillaChange}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-800 font-normal focus:outline-none"
                >
                  <option value="">-- Seleccione una o más plantillas --</option>
                  {plantillas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre || p.nombre_plantilla}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1 text-slate-800">Tiempo Est. Total (min):</label>
                <input
                  type="number"
                  readOnly
                  value={tiempoEst}
                  className="w-full p-2.5 bg-slate-200 border border-slate-300 rounded-lg text-slate-600 font-medium focus:outline-none"
                />
              </div>
            </div>

            {/* Cuadro de Mensajes y Alertas */}
            {mensaje.texto && (
              <div
                className={`p-3 rounded-lg text-center font-medium ${
                  mensaje.tipo === 'error'
                    ? 'bg-red-50 text-red-600 border border-red-200'
                    : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                }`}
              >
                {mensaje.texto}
              </div>
            )}

            {/* Botones de Mantenimiento */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleInicioMantenimiento}
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-2 rounded-xl text-center leading-tight shadow-sm transition"
              >
                Registrar Inicio<br />Mantenimiento
              </button>

              <button
                type="button"
                onClick={handleFinMantenimiento}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-2 rounded-xl text-center leading-tight shadow-sm transition"
              >
                Registrar Fin<br />Mantenimiento
              </button>
            </div>

            {/* Botón Finalizar Jornada */}
            <button
              type="button"
              onClick={handleFinalizarJornada}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl transition shadow-sm mt-2 text-sm"
            >
              Finalizar Jornada
            </button>
          </div>
        )}
      </div>
    </div>
  );
}