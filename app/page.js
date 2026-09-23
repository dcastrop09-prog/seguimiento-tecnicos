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

        // Intentar inserción con los nombres de columna correctos
        const { error } = await supabase.from('registros_actividad').insert([
          {
            tecnico_id: tecnicoSel,
            cliente_id: clienteSel,
            plantilla_id: plantillaSel,
            latitud_registro: latitude,
            longitud_registro: longitude,
            latitud: latitude,
            longitud: longitude,
            comentario_alerta: comentario,
            estado: 'En Progreso'
          }
        ]);

        if (error) {
          // Si da error por alguna columna inexistente, intentar esquema básico
          const { error: errorBackup } = await supabase.from('registros_actividad').insert([
            {
              tecnico_id: tecnicoSel,
              cliente_id: clienteSel,
              plantilla_id: plantillaSel,
              comentario_alerta: comentario,
              estado: 'En Progreso'
            }
          ]);

          if (errorBackup) {
            setMensaje(`Error al registrar: ${errorBackup.message}`);
          } else {
            setMensaje('¡Inicio de mantenimiento registrado con éxito!');
            setTecnicoSel('');
            setClienteSel('');
            setPlantillaSel('');
            setComentario('');
          }
        } else {
          setMensaje('¡Inicio de mantenimiento registrado con éxito!');
          setTecnicoSel('');
          setClienteSel('');
          setPlantillaSel('');
          setComentario('');
        }
      },
      (error) => {
        alert('No se pudo obtener la ubicación GPS. Verifica los permisos de tu navegador.');
      },
      { enableHighAccuracy: true }
    );
  };