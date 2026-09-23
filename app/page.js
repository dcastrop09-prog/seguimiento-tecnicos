'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { calcularDistanciaMetros } from '@/lib/geo';
import { AlertTriangle, CheckCircle } from 'lucide-react';

export default function RegistroTecnicoPage() {
  const [tecnicos, setTecnicos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [plantillas, setPlantillas] = useState([]);

  const [tecnicoSel, setTecnicoSel] = useState('');
  const [clienteSel, setClienteSel] = useState('');
  const [plantillaSel, setPlantillaSel] = useState('');
  const [tiempoEst, setTiempoEst] = useState('');

  const [cargandoUbicacion, setCargandoUbicacion] = useState(false);
  const [mensajeExito, setMensajeExito] = useState(null);
  
  // Estado para controlar el Modal de Alerta
  const [mostrarModal, setMostrarModal] = useState(false);
  const [datosAlerta, setDatosAlerta] = useState(null);
  const [comentarioAlerta, setComentarioAlerta] = useState('');

  // Cargar datos iniciales desde Supabase
  useEffect(() => {
    async function cargarDatos() {
      const { data: dataTecnicos } = await supabase.from('tecnicos').select('*');
      const { data: dataClientes } = await supabase.from('clientes').select('*');
      const { data: dataPlantillas } = await supabase.from('plantillas').select('*');

      if (dataTecnicos) setTecnicos(dataTecnicos);
      if (dataClientes) setClientes(dataClientes);
      if (dataPlantillas) setPlantillas(dataPlantillas);
    }
    cargarDatos();
  }, []);

  // Al seleccionar plantilla, actualizar el tiempo estimado
  const handlePlantillaChange = (e) => {
    const pId = e.target.value;
    setPlantillaSel(pId);
    const seleccionada = plantillas.find((p) => p.id.toString() === pId);
    if (seleccionada) {
      setTiempoEst(seleccionada.tiempo_est_min);
    } else {
      setTiempoEst('');
    }
  };

  // Lógica del botón: Registrar Inicio Mantenimiento
  const handleIniciarMantenimiento = () => {
    if (!tecnicoSel || !clienteSel || !plantillaSel) {
      alert('Por favor complete todos los campos (Técnico, Cliente y Plantilla).');
      return;
    }

    if (!navigator.geolocation) {
      alert('El navegador no soporta geolocalización GPS.');
      return;
    }

    setCargandoUbicacion(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latActual = position.coords.latitude;
        const lonActual = position.coords.longitude;

        const clienteObj = clientes.find((c) => c.id_cliente === clienteSel);
        const distancia = calcularDistanciaMetros(
          latActual,
          lonActual,
          clienteObj.latitud,
          clienteObj.longitud
        );

        setCargandoUbicacion(false);

        // Validación del radio de 20 metros
        if (distancia > 20) {
          setDatosAlerta({
            distancia,
            latActual,
            lonActual,
            clienteObj,
          });
          setMostrarModal(true);
        } else {
          await guardarInicio(latActual, lonActual, distancia, false, '');
        }
      },
      (error) => {
        setCargandoUbicacion(false);
        alert('Error al obtener la ubicación GPS: ' + error.message);
      },
      { enableHighAccuracy: true }
    );
  };

  // Función para guardar en la base de datos Supabase
  const guardarInicio = async (lat, lon, distancia, tieneAlerta, comentario) => {
    const { error } = await supabase.from('registros_actividad').insert([
      {
        tecnico_id: tecnicoSel,
        cliente_id: clienteSel,
        plantilla_id: plantillaSel,
        latitud_ingreso: lat,
        longitud_ingreso: lon,
        distancia_m: distancia,
        alerta_fuera_rango: tieneAlerta,
        comentario_alerta: comentario,
        estado: 'En Progreso',
      },
    ]);

    if (error) {
      alert('Error al guardar el registro: ' + error.message);
    } else {
      setMensajeExito({
        texto: 'Ingreso registrado exitosamente.',
        alertaTexto: tieneAlerta ? `Fuera de rango (${distancia}m)` : null,
      });
      setMostrarModal(false);
      setComentarioAlerta('');
    }
  };

  const handleEnviarComentario = async () => {
    if (!datosAlerta) return;
    await guardarInicio(
      datosAlerta.latActual,
      datosAlerta.lonActual,
      datosAlerta.distancia,
      true,
      comentarioAlerta
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white p-6 rounded-2xl shadow-lg w-full max-w-md border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-800 text-center mb-6">
          Registro de Actividad
        </h1>

        {/* Campo Técnico */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Técnico:
          </label>
          <select
            value={tecnicoSel}
            onChange={(e) => setTecnicoSel(e.target.value)}
            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
          >
            <option value="">-- Seleccionar Técnico --</option>
            {tecnicos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Campo Cliente */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Buscar Cliente:
          </label>
          <select
            value={clienteSel}
            onChange={(e) => setClienteSel(e.target.value)}
            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
          >
            <option value="">-- Seleccionar Cliente --</option>
            {clientes.map((c) => (
              <option key={c.id_cliente} value={c.id_cliente}>
                {c.id_cliente} - {c.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Campo Plantilla */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Plantilla(s):
          </label>
          <select
            value={plantillaSel}
            onChange={handlePlantillaChange}
            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
          >
            <option value="">-- Seleccionar Plantilla --</option>
            {plantillas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Tiempo Estimado Total */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Tiempo Est. Total (min):
          </label>
          <input
            type="text"
            value={tiempoEst}
            disabled
            className="w-full p-2.5 bg-slate-200 border border-slate-300 rounded-lg text-slate-700 font-semibold"
          />
        </div>

        {/* Botones de Acción */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <button
            onClick={handleIniciarMantenimiento}
            disabled={cargandoUbicacion}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-2 rounded-xl transition text-center text-sm shadow"
          >
            {cargandoUbicacion ? 'Obteniendo GPS...' : 'Registrar Inicio Mantenimiento'}
          </button>

          <button
            disabled
            className="bg-red-500 opacity-60 text-white font-semibold py-3 px-2 rounded-xl text-center text-sm shadow cursor-not-allowed"
          >
            Registrar Fin Mantenimiento
          </button>
        </div>

        <button
          disabled
          className="w-full bg-slate-800 opacity-80 text-white font-semibold py-3 rounded-xl mb-4 text-sm shadow cursor-not-allowed"
        >
          Finalizar Jornada
        </button>

        {/* Banner de Resultado/Alerta Inferior */}
        {mensajeExito && (
          <div className="p-4 bg-amber-100 border border-amber-200 rounded-xl flex items-center justify-between text-amber-900 text-sm">
            <div>
              <span className="font-semibold block">{mensajeExito.texto}</span>
              {mensajeExito.alertaTexto && (
                <span className="text-amber-800 font-bold">
                  {mensajeExito.alertaTexto}
                </span>
              )}
            </div>
            <CheckCircle className="w-6 h-6 text-emerald-600" />
          </div>
        )}
      </div>

      {/* Modal Emergente de Alerta (Si está fuera de los 20 metros) */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-100">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-lg mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              <span>Se detectaron alertas</span>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-amber-800 text-sm font-medium mb-4">
              • Fuera de rango ({datosAlerta?.distancia}m)
            </div>

            <label className="block text-sm font-medium text-slate-700 mb-2">
              Por favor, explique el motivo:
            </label>
            <textarea
              rows="3"
              value={comentarioAlerta}
              onChange={(e) => setComentarioAlerta(e.target.value)}
              placeholder="Escriba su comentario aquí..."
              className="w-full p-3 border border-slate-300 rounded-xl mb-4 text-sm text-slate-800 focus:outline-blue-500"
            ></textarea>

            <div className="flex gap-3">
              <button
                onClick={handleEnviarComentario}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition"
              >
                Enviar Comentario
              </button>
              <button
                onClick={() => setMostrarModal(false)}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-2.5 rounded-xl text-sm transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
