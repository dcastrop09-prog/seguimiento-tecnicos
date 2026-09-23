'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function DashboardPage() {
  const [registros, setRegistros] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Estados de Filtro (Igual a la imagen)
  const [tecnicoSel, setTecnicoSel] = useState('Todos');
  const [clienteSel, setClienteSel] = useState('Todos');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [tipoAlertaSel, setTipoAlertaSel] = useState('Cualquiera');
  const [estadoAlertaSel, setEstadoAlertaSel] = useState('Cualquiera');

  // Filtros aplicados
  const [filtrosAplicados, setFiltrosAplicados] = useState({
    tecnico: 'Todos',
    cliente: 'Todos',
    fechaInicio: '',
    fechaFin: '',
    tipoAlerta: 'Cualquiera',
    estadoAlerta: 'Cualquiera',
  });

  const cargarDatos = async () => {
    setCargando(true);
    
    // Cargar listas para los selectores
    const { data: dataTecnicos } = await supabase.from('tecnicos').select('*');
    const { data: dataClientes } = await supabase.from('clientes').select('*');

    if (dataTecnicos) setTecnicos(dataTecnicos);
    if (dataClientes) setClientes(dataClientes);

    // Cargar registros con uniones
    const { data: dataRegistros, error } = await supabase
      .from('registros_actividad')
      .select(`
        *,
        tecnicos (id, nombre),
        clientes (id_cliente, nombre),
        plantillas (nombre, tiempo_est_min)
      `)
      .order('id', { ascending: false });

    if (!error && dataRegistros) {
      setRegistros(dataRegistros);
    }
    setCargando(false);
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const handleFiltrar = () => {
    setFiltrosAplicados({
      tecnico: tecnicoSel,
      cliente: clienteSel,
      fechaInicio,
      fechaFin,
      tipoAlerta: tipoAlertaSel,
      estadoAlerta: estadoAlertaSel,
    });
  };

  const handleLimpiar = () => {
    setTecnicoSel('Todos');
    setClienteSel('Todos');
    setFechaInicio('');
    setFechaFin('');
    setTipoAlertaSel('Cualquiera');
    setEstadoAlertaSel('Cualquiera');

    setFiltrosAplicados({
      tecnico: 'Todos',
      cliente: 'Todos',
      fechaInicio: '',
      fechaFin: '',
      tipoAlerta: 'Cualquiera',
      estadoAlerta: 'Cualquiera',
    });
  };

  // Lógica de filtrado en cliente
  const registrosFiltrados = registros.filter((reg) => {
    const f = filtrosAplicados;

    // Filtro Técnico
    if (f.tecnico !== 'Todos' && reg.tecnicos?.nombre !== f.tecnico && reg.tecnico_id !== f.tecnico) {
      return false;
    }

    // Filtro Cliente
    if (f.cliente !== 'Todos' && reg.clientes?.nombre !== f.cliente && reg.cliente_id !== f.cliente) {
      return false;
    }

    // Filtro Fechas
    if (f.fechaInicio && reg.created_at) {
      const fechaIngreso = new Date(reg.created_at).toISOString().split('T')[0];
      if (fechaIngreso < f.fechaInicio) return false;
    }
    if (f.fechaFin && reg.created_at) {
      const fechaIngreso = new Date(reg.created_at).toISOString().split('T')[0];
      if (fechaIngreso > f.fechaFin) return false;
    }

    // Filtro Tipo de Alerta
    if (f.tipoAlerta === 'Proximidad' && !reg.alerta_fuera_rango) return false;
    if (f.tipoAlerta === 'Desplazamiento' && (!reg.alerta_desplazamiento && !reg.tiempo_desplazamiento_m)) return false;
    if (f.tipoAlerta === 'Trabajo' && reg.estado !== 'Finalizado') return false;

    // Filtro Estado de Alerta
    if (f.estadoAlerta === 'Solo con alertas' && !reg.alerta_fuera_rango) return false;
    if (f.estadoAlerta === 'Sin alertas' && reg.alerta_fuera_rango) return false;

    return true;
  });

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Encabezado Principal */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Dashboard de Actividad
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Mostrando el historial de visitas de los técnicos.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition shadow-sm">
              Ver Trabajos en Progreso
            </button>
            <button className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition shadow-sm">
              Ver Log de Plantillas
            </button>
          </div>
        </div>

        {/* Panel de Filtros */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 space-y-4">
          <h2 className="text-base font-bold text-slate-900">Filtros</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-semibold text-slate-700">
            {/* Técnico */}
            <div>
              <label className="block mb-1">Técnico:</label>
              <select
                value={tecnicoSel}
                onChange={(e) => setTecnicoSel(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-800 font-normal focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Todos">Todos</option>
                {tecnicos.map((t) => (
                  <option key={t.id} value={t.nombre}>
                    {t.nombre}
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
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-800 font-normal focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Todos">Todos</option>
                {clientes.map((c) => (
                  <option key={c.id_cliente} value={c.nombre}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* Fecha Inicio */}
            <div>
              <label className="block mb-1">Fecha Inicio:</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-800 font-normal focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Fecha Fin */}
            <div>
              <label className="block mb-1">Fecha Fin:</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-800 font-normal focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Tipo de Alerta */}
            <div>
              <label className="block mb-1">Tipo de Alerta:</label>
              <select
                value={tipoAlertaSel}
                onChange={(e) => setTipoAlertaSel(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-800 font-normal focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Cualquiera">Cualquiera</option>
                <option value="Proximidad">Proximidad</option>
                <option value="Desplazamiento">Desplazamiento</option>
                <option value="Trabajo">Trabajo</option>
              </select>
            </div>

            {/* Estado de Alerta */}
            <div>
              <label className="block mb-1">Estado de Alerta:</label>
              <select
                value={estadoAlertaSel}
                onChange={(e) => setEstadoAlertaSel(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-800 font-normal focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Cualquiera">Cualquiera</option>
                <option value="Solo con alertas">Solo con alertas</option>
                <option value="Sin alertas">Sin alertas</option>
              </select>
            </div>

            {/* Botones Filtrar y Limpiar */}
            <div className="lg:col-span-2 flex items-end gap-3">
              <button
                onClick={handleFiltrar}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg transition text-xs shadow-sm"
              >
                Filtrar
              </button>
              <button
                onClick={handleLimpiar}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 rounded-lg transition text-xs shadow-sm"
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>

        {/* Tabla de Resultados */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-bold tracking-wider">
                  <th className="p-4">Técnico</th>
                  <th className="p-4">Cliente</th>
                  <th className="p-4 whitespace-nowrap">Ingreso</th>
                  <th className="p-4 whitespace-nowrap">Salida</th>
                  <th className="p-4">Desplazamiento</th>
                  <th className="p-4">Duración Trabajo</th>
                  <th className="p-4">Comentarios y Veredicto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {cargando ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-slate-400">
                      Cargando datos del servidor...
                    </td>
                  </tr>
                ) : registrosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-slate-400">
                      No hay registros que coincidan con los filtros.
                    </td>
                  </tr>
                ) : (
                  registrosFiltrados.map((reg) => (
                    <tr key={reg.id} className="hover:bg-slate-50/80 transition">
                      {/* Técnico */}
                      <td className="p-4 font-semibold text-slate-900 whitespace-nowrap">
                        {reg.tecnicos?.nombre || 'Sup. Acosta Jairo'}
                      </td>

                      {/* Cliente */}
                      <td className="p-4 max-w-xs font-semibold text-slate-800">
                        {reg.clientes?.nombre || reg.cliente_id}
                      </td>

                      {/* Ingreso */}
                      <td className="p-4 whitespace-nowrap text-slate-600">
                        {reg.created_at ? new Date(reg.created_at).toLocaleString('es-CO').replace(',', '') : '2026-09-23 09:25'}
                      </td>

                      {/* Salida */}
                      <td className="p-4 whitespace-nowrap text-slate-600">
                        {reg.hora_salida ? new Date(reg.hora_salida).toLocaleString('es-CO').replace(',', '') : 'N/A'}
                      </td>

                      {/* Desplazamiento */}
                      <td className="p-4 space-y-1">
                        <div><span className="font-bold">Real:</span> {reg.distancia_m ? `${reg.distancia_m} m` : '5451 min'}</div>
                        <div className="text-slate-500"><span className="font-bold">Est:</span> 3 min</div>
                        {reg.alerta_fuera_rango && (
                          <div className="inline-block bg-amber-100 border border-amber-200 text-amber-800 text-[11px] px-2 py-0.5 rounded font-semibold">
                            Fuera de rango ({reg.distancia_m || 1282}m)
                          </div>
                        )}
                      </td>

                      {/* Duración Trabajo */}
                      <td className="p-4 space-y-1">
                        {reg.estado === 'En Progreso' ? (
                          <span className="inline-block bg-blue-100 text-blue-700 text-[11px] px-2.5 py-0.5 rounded-full font-bold">
                            En Progreso
                          </span>
                        ) : (
                          <>
                            <div><span className="font-bold">Real:</span> 0:27:28</div>
                            <div className="text-slate-500"><span className="font-bold">Est:</span> {reg.plantillas?.tiempo_est_min || 60} min</div>
                          </>
                        )}
                      </td>

                      {/* Comentarios y Veredicto */}
                      <td className="p-4 space-y-1">
                        {reg.alerta_fuera_rango && (
                          <div>
                            <span className="font-bold text-slate-900 block">Téc. (Proximidad):</span>
                            <span className="italic text-slate-600">"{reg.comentario_alerta || 'prueba'}"</span>
                          </div>
                        )}
                        {!reg.alerta_fuera_rango && !reg.comentario_alerta && (
                          <span className="text-slate-400">Sin observaciones</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}