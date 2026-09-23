'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// 1. Cálculo de distancia geográfica en kilómetros entre coordenadas
function calcularDistanciaKm(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return 0;
  const R = 6371; // Radio de la Tierra en km
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

// 2. Estimación DINÁMICA de tiempo de viaje según distancia real entre Entidad A y Entidad B
function estimarTiempoViajeMinutos(lat1, lon1, lat2, lon2) {
  const distLineaRectaKm = calcularDistanciaKm(lat1, lon1, lat2, lon2);
  if (distLineaRectaKm <= 0) return 10; // Tiempo mínimo por defecto si están en el mismo punto/sector

  // Factor de curvatura vial (1.3) para estimar recorrido real por calles
  const distRutaAproxKm = distLineaRectaKm * 1.3;

  // Velocidad promedio urbana estimada: 30 km/h (0.5 km por minuto)
  // Se agregan 5 minutos base por semáforos, parqueo y arranque.
  const tiempoMinutosCalculado = Math.round((distRutaAproxKm / 30) * 60) + 5;
  return tiempoMinutosCalculado;
}

export default function Dashboard() {
  const [registros, setRegistros] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Filtros
  const [filtroTecnico, setFiltroTecnico] = useState('Todos');
  const [filtroCliente, setFiltroCliente] = useState('Todos');
  const [filtroFechaInicio, setFiltroFechaInicio] = useState('');
  const [filtroFechaFin, setFiltroFechaFin] = useState('');
  const [filtroTipoAlerta, setFiltroTipoAlerta] = useState('Cualquiera');
  const [filtroEstadoAlerta, setFiltroEstadoAlerta] = useState('Cualquiera');

  const cargarDatos = async () => {
    try {
      setCargando(true);

      const [
        { data: dataReg },
        { data: dataTec },
        { data: dataCli },
        { data: dataPla }
      ] = await Promise.all([
        supabase.from('registros_actividad').select('*').order('created_at', { ascending: true }),
        supabase.from('tecnicos').select('*'),
        supabase.from('clientes').select('*'),
        supabase.from('plantillas').select('*')
      ]);

      if (dataTec) setTecnicos(dataTec);
      if (dataCli) setClientes(dataCli);

      const mapTecnicos = Object.fromEntries(
        (dataTec || []).map((t) => [String(t.id), t.nombre || t.nombre_tecnico])
      );
      const mapClientesObj = Object.fromEntries(
        (dataCli || []).map((c) => [String(c.id || c.id_cliente), c])
      );
      const mapPlantillas = Object.fromEntries(
        (dataPla || []).map((p) => [
          String(p.id),
          {
            nombre: p.nombre || p.nombre_plantilla,
            tiempoEst: p.tiempo_estimado || p.duracion_minutos || 60
          }
        ])
      );

      // Rastreador del último cliente visitado por cada técnico
      const ultimoRegistroPorTecnico = {};

      const registrosProcesados = (dataReg || []).map((reg) => {
        const clienteObj = mapClientesObj[String(reg.cliente_id)] || {};
        const plantillaObj = mapPlantillas[String(reg.plantilla_id)] || {};
        
        const tecId = String(reg.tecnico_id);
        const fechaIngreso = reg.created_at || reg.fecha_inicio || reg.fecha_registro;
        const fechaSalida = reg.fecha_fin || reg.updated_at;

        // A. DURACIÓN DEL TRABAJO EN LA ENTIDAD
        let duracionRealMin = 0;
        if (fechaIngreso && fechaSalida && reg.estado === 'Finalizado') {
          const diffMs = new Date(fechaSalida) - new Date(fechaIngreso);
          duracionRealMin = Math.round(diffMs / (1000 * 60));
        }

        const tiempoEstTrabajo = plantillaObj.tiempoEst || 60;
        const excedeTrabajo = duracionRealMin > tiempoEstTrabajo;

        // B. DESPLAZAMIENTO DINÁMICO DESDE LA ENTIDAD ANTERIOR
        let desplazamientoRealMin = null;
        let desplazamientoEstMin = null;
        let alertaDesplazamiento = false;

        const anterior = ultimoRegistroPorTecnico[tecId];

        if (anterior && anterior.fechaSalida && fechaIngreso) {
          // 1. Tiempo Real transcurrido desde la salida de la Entidad A hasta el ingreso a la Entidad B
          const diffDespMs = new Date(fechaIngreso) - new Date(anterior.fechaSalida);
          desplazamientoRealMin = Math.max(0, Math.round(diffDespMs / (1000 * 60)));

          // 2. Coordenadas de Entidad Origen (A) y Entidad Destino (B)
          const lat1 = anterior.clienteObj?.latitud !== undefined ? anterior.clienteObj.latitud : anterior.clienteObj?.latitud_cliente;
          const lon1 = anterior.clienteObj?.longitud !== undefined ? anterior.clienteObj.longitud : anterior.clienteObj?.longitud_cliente;
          const lat2 = clienteObj?.latitud !== undefined ? clienteObj.latitud : clienteObj?.latitud_cliente;
          const lon2 = clienteObj?.longitud !== undefined ? clienteObj.longitud : clienteObj?.longitud_cliente;

          // 3. Estimación dinámica basada en la distancia entre A y B
          if (lat1 && lon1 && lat2 && lon2) {
            desplazamientoEstMin = estimarTiempoViajeMinutos(
              Number(lat1),
              Number(lon1),
              Number(lat2),
              Number(lon2)
            );
          } else {
            desplazamientoEstMin = 15; // Estimación estándar por defecto si falta coordenadas en alguna entidad
          }

          // 4. Se genera la Alerta si el tiempo real supera el tiempo estimado específico + 5 minutos de tolerancia
          if (desplazamientoRealMin > (desplazamientoEstMin + 5)) {
            alertaDesplazamiento = true;
          }
        }

        // Actualizar último cliente finalizado por el técnico
        if (fechaSalida && reg.estado === 'Finalizado') {
          ultimoRegistroPorTecnico[tecId] = {
            fechaSalida,
            clienteObj
          };
        }

        // Determinar Tipo de Alerta para el Administrador
        let tipoAlertaCalculado = 'Ninguna';
        if (alertaDesplazamiento && excedeTrabajo) {
          tipoAlertaCalculado = 'Desplazamiento y Trabajo';
        } else if (alertaDesplazamiento) {
          tipoAlertaCalculado = 'Desplazamiento';
        } else if (excedeTrabajo) {
          tipoAlertaCalculado = 'Exceso Tiempo';
        }

        return {
          ...reg,
          nombre_tecnico: mapTecnicos[tecId] || 'Técnico N/A',
          nombre_cliente: clienteObj?.nombre || clienteObj?.nombre_cliente || 'Cliente N/A',
          nombre_plantilla: plantillaObj.nombre || 'Plantilla N/A',
          fechaIngreso,
          fechaSalida,
          duracionRealMin,
          tiempoEstTrabajo,
          excedeTrabajo,
          desplazamientoRealMin,
          desplazamientoEstMin,
          alertaDesplazamiento,
          tipoAlerta: reg.tipo_alerta || tipoAlertaCalculado,
          estadoAlerta: reg.estado_alerta || (alertaDesplazamiento || excedeTrabajo ? 'Pendiente' : 'Aprobada'),
          comentarioTecnico: reg.comentario_alerta || reg.comentario || 'NA',
          comentarioGerencia: reg.comentario_gerencia || ''
        };
      });

      setRegistros(registrosProcesados.reverse());
    } catch (err) {
      console.error('Error cargando el dashboard:', err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const handleLimpiarFiltros = () => {
    setFiltroTecnico('Todos');
    setFiltroCliente('Todos');
    setFiltroFechaInicio('');
    setFiltroFechaFin('');
    setFiltroTipoAlerta('Cualquiera');
    setFiltroEstadoAlerta('Cualquiera');
  };

  const registrosFiltrados = registros.filter((reg) => {
    if (filtroTecnico !== 'Todos' && reg.nombre_tecnico !== filtroTecnico) return false;
    if (filtroCliente !== 'Todos' && reg.nombre_cliente !== filtroCliente) return false;
    
    if (filtroFechaInicio && reg.fechaIngreso) {
      const fIng = new Date(reg.fechaIngreso).toISOString().split('T')[0];
      if (fIng < filtroFechaInicio) return false;
    }
    
    if (filtroFechaFin && reg.fechaIngreso) {
      const fIng = new Date(reg.fechaIngreso).toISOString().split('T')[0];
      if (fIng > filtroFechaFin) return false;
    }

    if (filtroTipoAlerta !== 'Cualquiera' && reg.tipoAlerta !== filtroTipoAlerta) return false;
    if (filtroEstadoAlerta !== 'Cualquiera' && reg.estadoAlerta !== filtroEstadoAlerta) return false;

    return true;
  });

  const formatearFechaHora = (strFecha) => {
    if (!strFecha) return 'N/A';
    const d = new Date(strFecha);
    const fecha = d.toISOString().split('T')[0];
    const hora = d.toTimeString().split(' ')[0].substring(0, 5);
    return { fecha, hora };
  };

  const formatearDuracionStr = (minutos) => {
    if (!minutos || minutos <= 0) return '0:00:00';
    const hrs = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return `${hrs}:${mins < 10 ? '0' : ''}${mins}:00`;
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Cabecera y Botones Superiores */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Dashboard de Actividad
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">
              Mostrando el historial de visitas de los técnicos con estimación dinámica de desplazamiento entre entidades.
            </p>
          </div>
          <div className="flex gap-3">
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-sm transition">
              Ver Trabajos en Progreso
            </button>
            <button className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-sm transition">
              Ver Log de Plantillas
            </button>
          </div>
        </div>

        {/* Panel de Filtros */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-xs font-bold text-slate-700">Filtros</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block mb-1 text-slate-600 font-semibold">Técnico:</label>
              <select
                value={filtroTecnico}
                onChange={(e) => setFiltroTecnico(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="Todos">Todos</option>
                {tecnicos.map((t) => {
                  const name = t.nombre || t.nombre_tecnico;
                  return <option key={t.id} value={name}>{name}</option>;
                })}
              </select>
            </div>

            <div>
              <label className="block mb-1 text-slate-600 font-semibold">Cliente:</label>
              <select
                value={filtroCliente}
                onChange={(e) => setFiltroCliente(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="Todos">Todos</option>
                {clientes.map((c) => {
                  const name = c.nombre || c.nombre_cliente;
                  return <option key={c.id || c.id_cliente} value={name}>{name}</option>;
                })}
              </select>
            </div>

            <div>
              <label className="block mb-1 text-slate-600 font-semibold">Fecha Inicio:</label>
              <input
                type="date"
                value={filtroFechaInicio}
                onChange={(e) => setFiltroFechaInicio(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block mb-1 text-slate-600 font-semibold">Fecha Fin:</label>
              <input
                type="date"
                value={filtroFechaFin}
                onChange={(e) => setFiltroFechaFin(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs pt-1">
            <div>
              <label className="block mb-1 text-slate-600 font-semibold">Tipo de Alerta:</label>
              <select
                value={filtroTipoAlerta}
                onChange={(e) => setFiltroTipoAlerta(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="Cualquiera">Cualquiera</option>
                <option value="Desplazamiento">Desplazamiento</option>
                <option value="Exceso Tiempo">Exceso Tiempo</option>
                <option value="Ninguna">Ninguna</option>
              </select>
            </div>

            <div>
              <label className="block mb-1 text-slate-600 font-semibold">Estado de Alerta:</label>
              <select
                value={filtroEstadoAlerta}
                onChange={(e) => setFiltroEstadoAlerta(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="Cualquiera">Cualquiera</option>
                <option value="Pendiente">Pendiente</option>
                <option value="Aprobada">Aprobada</option>
                <option value="Rechazada">Rechazada</option>
              </select>
            </div>

            <div className="md:col-span-2 flex gap-3 items-end">
              <button
                onClick={() => {}}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl transition text-center shadow-sm"
              >
                Filtrar
              </button>
              <button
                onClick={handleLimpiarFiltros}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2.5 rounded-xl transition text-center"
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>

        {/* Tabla con Alertas Dinámicas */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {cargando ? (
            <div className="p-8 text-center text-slate-400 text-xs">Cargando registros...</div>
          ) : registrosFiltrados.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No se encontraron registros con los filtros seleccionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase font-bold text-[10px] tracking-wider">
                  <tr>
                    <th className="p-4">TÉCNICO</th>
                    <th className="p-4">CLIENTE</th>
                    <th className="p-4">INGRESO</th>
                    <th className="p-4">SALIDA</th>
                    <th className="p-4">DESPLAZAMIENTO</th>
                    <th className="p-4">DURACIÓN TRABAJO</th>
                    <th className="p-4">COMENTARIOS Y VERDICTO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {registrosFiltrados.map((reg, idx) => {
                    const ing = formatearFechaHora(reg.fechaIngreso);
                    const sal = formatearFechaHora(reg.fechaSalida);

                    return (
                      <tr key={reg.id || idx} className="hover:bg-slate-50 transition">
                        <td className="p-4 font-semibold text-slate-800 whitespace-nowrap">
                          {reg.nombre_tecnico}
                        </td>

                        <td className="p-4 font-semibold text-slate-800 max-w-[180px]">
                          {reg.nombre_cliente}
                        </td>

                        <td className="p-4 whitespace-nowrap text-slate-600">
                          <div>{ing.fecha}</div>
                          <div className="font-semibold text-slate-800">{ing.hora}</div>
                        </td>

                        <td className="p-4 whitespace-nowrap text-slate-600">
                          {reg.fechaSalida ? (
                            <>
                              <div>{sal.fecha}</div>
                              <div className="font-semibold text-slate-800">{sal.hora}</div>
                            </>
                          ) : (
                            <span className="text-amber-600 font-semibold">En progreso</span>
                          )}
                        </td>

                        {/* Desplazamiento Dinámico */}
                        <td className="p-4 whitespace-nowrap">
                          {reg.desplazamientoRealMin !== null ? (
                            <div className="space-y-1">
                              <div><strong>Real:</strong> {reg.desplazamientoRealMin} min</div>
                              <div className="text-slate-400"><strong>Est:</strong> {reg.desplazamientoEstMin} min</div>
                              
                              {reg.alertaDesplazamiento && (
                                <div className="bg-emerald-100 text-emerald-900 border border-emerald-300 p-2 rounded-lg text-[11px] font-medium space-y-0.5 max-w-[210px]">
                                  <div>
                                    Desplazamiento excedido. Real: {reg.desplazamientoRealMin}m, Est: {reg.desplazamientoEstMin}m
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 font-semibold">N/A</span>
                          )}
                        </td>

                        {/* Duración Trabajo */}
                        <td className="p-4 whitespace-nowrap">
                          <div className="space-y-1">
                            <div><strong className="text-slate-800">Real:</strong> {formatearDuracionStr(reg.duracionRealMin)}</div>
                            <div><strong className="text-slate-800">Est:</strong> {reg.tiempoEstTrabajo} min</div>
                            
                            {reg.excedeTrabajo && (
                              <div className="bg-amber-100 text-amber-900 border border-amber-200 p-2 rounded-lg text-[11px] font-medium space-y-0.5 max-w-[210px]">
                                <div>Tiempo de trabajo excedido. Real: {reg.duracionRealMin}m, Est: {reg.tiempoEstTrabajo}m</div>
                                <button className="text-blue-600 underline font-semibold text-[10px]">
                                  (Revisar)
                                </button>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Comentarios y Veredicto */}
                        <td className="p-4 text-[11px] space-y-2 min-w-[200px]">
                          <div>
                            <span className="font-bold text-slate-800">Téc. (Trabajo):</span>
                            <div className="text-slate-600">"{reg.comentarioTecnico}"</div>
                          </div>

                          {reg.comentarioGerencia ? (
                            <div>
                              <span className="font-bold text-slate-800">Gerencia (Viaje):</span>
                              <div className="mt-0.5">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  reg.estadoAlerta === 'Aprobada' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {reg.estadoAlerta === 'Aprobada' ? 'Approved' : 'Rejected'}
                                </span>
                              </div>
                              <div className="text-slate-500 italic mt-0.5">"{reg.comentarioGerencia}"</div>
                            </div>
                          ) : (
                            (reg.alertaDesplazamiento || reg.excedeTrabajo) && (
                              <span className="inline-block bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold text-[10px]">
                                Requiere Revisión
                              </span>
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}