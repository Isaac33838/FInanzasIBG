// ==========================================
// Finanzas Personales IBG - App de Control
// ==========================================

(function () {
    'use strict';

    // ===== STATE =====
    let transactions = JSON.parse(localStorage.getItem('ibg_transactions')) || [];
    let debtPlans = JSON.parse(localStorage.getItem('ibg_debt_plans')) || [];
    let editingId = null;
    let nextId = transactions.length
        ? Math.max(...transactions.map((t) => t.id)) + 1
        : 1;
    let nextDebtPlanId = debtPlans.length
        ? Math.max(...debtPlans.map((p) => p.id)) + 1
        : 1;

    // ===== DOM ELEMENTS =====
    const form = document.getElementById('formulario-transaccion');
    const formEdit = document.getElementById('formulario-editar');
    const tablaBody = document.getElementById('tabla-transacciones-body');
    const sinTransaccionesMsg = document.getElementById('sin-transacciones-mensaje');
    const totalIngresosEl = document.getElementById('total-ingresos');
    const totalGastosEl = document.getElementById('total-gastos');
    const totalDeudasResumenEl = document.getElementById('total-deudas');
    const balanceNetoEl = document.getElementById('balance-neto');
    const buscarInput = document.getElementById('buscar');
    const filtroTipo = document.getElementById('filtro-tipo');
    const filtroCategoria = document.getElementById('filtro-categoria');
    const filtroOrdenFecha = document.getElementById('filtro-orden-fecha');
    const filtroOrdenMonto = document.getElementById('filtro-orden-monto');
    const btnOrdenMonto = document.getElementById('btn-orden-monto');
    const btnOrdenFecha = document.getElementById('btn-orden-fecha');
    const btnExportar = document.getElementById('btn-exportar');
    const btnExportarTodo = document.getElementById('btn-exportar-todo');
    const btnLimpiar = document.getElementById('btn-limpiar');
    const modal = document.getElementById('modal-editar');
    const cerrarModal = document.getElementById('cerrar-modal');
    const btnCancelar = document.getElementById('btn-cancelar');

    // Plan de Deudas
    const btnHome = document.getElementById('btn-home');
    const btnDeudasPlan = document.getElementById('btn-deudas-plan');
    const btnEstadisticas = document.getElementById('btn-estadisticas');
    const seccionPlanDeudas = document.getElementById('seccion-plan-deudas');
    const seccionEstadisticas = document.getElementById('seccion-estadisticas');
    const formularioPlan = document.getElementById('formulario-plan-deuda');
    const planTablaBody = document.getElementById('plan-tabla-body');
    const planTotalDeudas = document.getElementById('plan-total-deudas');
    const planTotalIntereses = document.getElementById('plan-total-intereses');
    const planTotalPagar = document.getElementById('plan-total-pagar');

    // Estadísticas
    const estadisticaPromIngreso = document.getElementById('estadistica-prom-ingreso');
    const estadisticaPromGasto = document.getElementById('estadistica-prom-gasto');
    const estadisticaPromBalance = document.getElementById('estadistica-prom-balance');
    const catMayorNombre = document.getElementById('cat-mayor-nombre');
    const catMayorBarra = document.getElementById('cat-mayor-barra');
    const catMayorMonto = document.getElementById('cat-mayor-monto');
    const catMayorPct = document.getElementById('cat-mayor-pct');

    // ===== FECHA POR DEFECTO =====
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('fecha').value = today;
    document.getElementById('plan-fecha-inicio').value = today;

    // ===== MÉTODOS AUXILIARES =====
    function generarId() {
        return nextId++;
    }

    function formatearMoneda(valor) {
        return valor.toLocaleString('es-ES', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    }

    function capitalizar(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function obtenerCategorias() {
        const categorias = new Set(transactions.map((t) => t.categoria));
        return [...categorias].sort();
    }

    function actualizarSelectCategorias() {
        const categorias = obtenerCategorias();
        filtroCategoria.innerHTML =
            '<option value="todos">Todas las categorías</option>';
        categorias.forEach((cat) => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = capitalizar(cat.replace(/-/g, ' '));
            filtroCategoria.appendChild(opt);
        });
    }

    // ===== PERSISTENCIA =====
    function guardar() {
        localStorage.setItem('ibg_transactions', JSON.stringify(transactions));
    }

    function guardarPlanes() {
        localStorage.setItem('ibg_debt_plans', JSON.stringify(debtPlans));
    }

    // ===== CÁLCULO DE PLAN DE DEUDAS =====
    function calcularCuota(monto, tasaAnual, plazoMeses, cuotaSugerida) {
        if (cuotaSugerida && cuotaSugerida > 0) {
            return cuotaSugerida;
        }
        const tasaMensual = (tasaAnual / 100) / 12;
        if (tasaMensual === 0) return monto / plazoMeses;
        const cuota = monto * (tasaMensual * Math.pow(1 + tasaMensual, plazoMeses)) / (Math.pow(1 + tasaMensual, plazoMeses) - 1);
        return cuota;
    }

    function generarTablaAmortizacion(plan) {
        const tabla = [];
        let saldo = plan.monto;
        const tasaMensual = (plan.tasa / 100) / 12;
        const cuota = plan.cuota;
        // fechaInicio es string YYYY-MM-DD (sin hora, sin zona horaria)
        const [anio, mes, dia] = plan.fechaInicio.split('-').map(Number);

        for (let i = 1; i <= plan.plazo; i++) {
            const interes = saldo * tasaMensual;
            const amortizacion = cuota - interes;
            saldo -= amortizacion;

            // Calcular fecha de pago sumando meses sin desfase horario
            let mesPago = mes - 1 + i; // meses desde enero (0-index)
            let anioPago = anio + Math.floor(mesPago / 12);
            mesPago = (mesPago % 12 + 12) % 12;
            const fechaPago = anioPago + '-' + String(mesPago + 1).padStart(2, '0') + '-' + String(dia).padStart(2, '0');

            tabla.push({
                mes: i,
                cuota: cuota,
                interes: interes,
                amortizacion: amortizacion,
                saldo: saldo > 0 ? saldo : 0,
                fecha: fechaPago
            });
        }

        return tabla;
    }

    function agregarPlanDeuda(e) {
        e.preventDefault();

        const nombre = document.getElementById('plan-nombre').value.trim();
        const monto = parseFloat(document.getElementById('plan-monto').value);
        const tasa = parseFloat(document.getElementById('plan-tasa').value);
        const plazo = parseInt(document.getElementById('plan-plazo').value);
        const cuotaInput = document.getElementById('plan-cuota').value.trim();
        const fechaInicio = document.getElementById('plan-fecha-inicio').value; // YYYY-MM-DD string

        let cuota;
        if (cuotaInput !== '') {
            cuota = parseFloat(cuotaInput);
        }
        if (!cuota || isNaN(cuota)) {
            cuota = calcularCuota(monto, tasa, plazo, null);
        }

        const plan = {
            id: nextDebtPlanId++,
            nombre,
            monto,
            tasa,
            plazo,
            cuota,
            fechaInicio: fechaInicio,
            fechaCreacion: new Date().toISOString().split('T')[0]
        };

        debtPlans.push(plan);
        guardarPlanes();
        renderizarPlanDeudas();
        formularioPlan.reset();
        document.getElementById('plan-fecha-inicio').value = new Date().toISOString().split('T')[0];
    }

    function eliminarPlan(id) {
        if (confirm('¿Eliminar este plan de deuda?')) {
            debtPlans = debtPlans.filter(p => p.id !== id);
            guardarPlanes();
            renderizarPlanDeudas();
        }
    }

    function renderizarPlanDeudas() {
        planTablaBody.innerHTML = '';

        if (debtPlans.length === 0) {
            planTablaBody.innerHTML = '<tr><td colspan="7" class="sin-datos">No hay deudas planificadas. Agrega una para ver el calendario.</td></tr>';
            planTotalDeudas.textContent = '$0.00';
            planTotalIntereses.textContent = '$0.00';
            planTotalPagar.textContent = '$0.00';
            return;
        }

        let totalDeudas = 0;
        let totalIntereses = 0;
        let totalPagar = 0;

        debtPlans.forEach(plan => {
            totalDeudas += plan.monto;
            const tabla = generarTablaAmortizacion(plan);
            const interesTotalPlan = tabla.reduce((sum, row) => sum + row.interes, 0);
            totalIntereses += interesTotalPlan;
            totalPagar += plan.monto + interesTotalPlan;

            const headerRow = document.createElement('tr');
            headerRow.innerHTML = `
                <td colspan="7" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; font-weight: 600; padding: 12px 8px;">
                    <i class="fas fa-credit-card"></i> ${plan.nombre} — Cuota: $${formatearMoneda(plan.cuota)}/mes • Plazo: ${plan.plazo} meses
                    <button class="btn-eliminar-plan" data-id="${plan.id}" style="float: right; background: transparent; border: none; color: #ef4444; cursor: pointer;">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            planTablaBody.appendChild(headerRow);

            tabla.forEach(row => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${row.mes}</td>
                    <td></td>
                    <td class="monto">$${formatearMoneda(row.cuota)}</td>
                    <td class="interes">$${formatearMoneda(row.interes)}</td>
                    <td class="amortizacion">$${formatearMoneda(row.amortizacion)}</td>
                    <td class="monto">$${formatearMoneda(row.saldo)}</td>
                    <td>${row.fecha}</td>
                `;
                planTablaBody.appendChild(tr);
            });
        });

        planTotalDeudas.textContent = '$' + formatearMoneda(totalDeudas);
        planTotalIntereses.textContent = '$' + formatearMoneda(totalIntereses);
        planTotalPagar.textContent = '$' + formatearMoneda(totalPagar);
    }

    function actualizarResumen() {
        let ingresos = 0;
        let gastos = 0;
        transactions.forEach((t) => {
            if (t.tipo === 'ingreso') ingresos += t.monto;
            else if (t.tipo === 'gasto') gastos += t.monto;
        });
        const balance = ingresos - gastos;

        totalIngresosEl.textContent = '$' + formatearMoneda(ingresos);
        totalGastosEl.textContent = '$' + formatearMoneda(gastos);
        balanceNetoEl.textContent = '$' + formatearMoneda(balance);

        if (balance >= 0) {
            balanceNetoEl.style.color = '#10b981';
        } else {
            balanceNetoEl.style.color = '#ef4444';
        }
    }

    // ===== RENDERIZAR LISTA =====
    function obtenerTransaccionesFiltradas() {
        const busqueda = buscarInput.value.toLowerCase();
        const tipoFiltro = filtroTipo.value;
        const catFiltro = filtroCategoria.value;

        return transactions.filter((t) => {
            const matchBusqueda =
                t.descripcion.toLowerCase().includes(busqueda) ||
                t.categoria.toLowerCase().includes(busqueda);
            const matchTipo = tipoFiltro === 'todos' || t.tipo === tipoFiltro;
            const matchCat = catFiltro === 'todos' || t.categoria === catFiltro;
            return matchBusqueda && matchTipo && matchCat;
        });
    }

    function agruparPorFecha(transacciones) {
        const grupos = {};
        transacciones.forEach(t => {
            const fecha = t.fecha;
            if (!grupos[fecha]) grupos[fecha] = [];
            grupos[fecha].push(t);
        });
        return grupos;
    }

    function ordenarTransacciones(transacciones) {
        const ordenFecha = filtroOrdenFecha.value;
        const ordenMonto = filtroOrdenMonto.value;
        
        let resultado = [...transacciones];
        
        // Orden por fecha
        if (ordenFecha === 'asc') {
            resultado.sort((a, b) => a.fecha.localeCompare(b.fecha));
        } else {
            resultado.sort((a, b) => b.fecha.localeCompare(a.fecha));
        }
        
        // Orden por monto (si se seleccionó)
        if (ordenMonto !== 'none') {
            if (ordenMonto === 'mayor') {
                resultado.sort((a, b) => b.monto - a.monto);
            } else {
                resultado.sort((a, b) => a.monto - b.monto);
            }
        }
        
        return resultado;
    }

    function renderizarTabla() {
        const filtradas = obtenerTransaccionesFiltradas();
        const soloIngresosGastos = filtradas.filter(t => t.tipo !== 'deuda');
        const ordenadas = ordenarTransacciones(soloIngresosGastos);

        tablaBody.innerHTML = '';

        if (ordenadas.length === 0) {
            sinTransaccionesMsg.style.display = 'block';
            tablaBody.innerHTML = '';
        } else {
            sinTransaccionesMsg.style.display = 'none';

            const grupos = agruparPorFecha(ordenadas);
            const fechasOrdenadas = Object.keys(grupos).sort((a, b) => {
                if (filtroOrdenFecha.value === 'asc') {
                    return a.localeCompare(b);
                }
                return b.localeCompare(a);
            });

            fechasOrdenadas.forEach(fecha => {
                const grupoHeader = document.createElement('tr');
                grupoHeader.className = 'grupo-fecha';
                grupoHeader.innerHTML = `<td colspan="6">${formatearFecha(fecha)}</td>`;
                tablaBody.appendChild(grupoHeader);

                grupos[fecha].forEach(t => {
                    const tipoTexto = t.tipo === 'ingreso' ? 'Ingreso' : 
                                      t.tipo === 'gasto' ? 'Gasto' : 'Deuda';
                    const signo = t.tipo === 'ingreso' ? '+' : '-';
                    
                    const tr = document.createElement('tr');
                    tr.className = 'transaccion-fila';
                    tr.innerHTML = `
                        <td>${tipoTexto}</td>
                        <td>${escaparHtml(t.descripcion)}</td>
                        <td>${capitalizar(t.categoria.replace(/-/g, ' '))}</td>
                        <td>${formatearFecha(t.fecha)}</td>
                        <td class="monto-${t.tipo}">${signo} $${formatearMoneda(t.monto)}</td>
                        <td>
                            <button class="btn-accion btn-editar-tabla" data-id="${t.id}">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-accion btn-eliminar-tabla" data-id="${t.id}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    `;
                    tablaBody.appendChild(tr);
                });
            });
        }

        actualizarResumen();
        actualizarSelectCategorias();
        renderizarEstadisticas();
    }

    function escaparHtml(str) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    function formatearFecha(fechaStr) {
        const partes = fechaStr.split('-');
        return partes[2] + '/' + partes[1] + '/' + partes[0];
    }

    // ===== AGREGAR TRANSMACCIÓN =====
    form.addEventListener('submit', function (e) {
        e.preventDefault();

        const descripcion = document.getElementById('descripcion').value.trim();
        const monto = parseFloat(document.getElementById('monto').value);
        const categoria = document.getElementById('categoria').value;
        const tipo = document.getElementById('tipo').value;
        const fecha = document.getElementById('fecha').value;

        if (!descripcion || !monto || monto <= 0) return;

        const transaction = {
            id: generarId(),
            descripcion,
            monto: parseFloat(monto.toFixed(2)),
            categoria,
            tipo,
            fecha,
        };

        transactions.push(transaction);
        guardar();
        renderizarTabla();
        form.reset();
        document.getElementById('fecha').value = today;
        document.getElementById('monto').focus();
    });

    // ===== ELIMINAR =====
    document.addEventListener('click', function (e) {
        if (e.target.closest('.btn-eliminar-tabla')) {
            const btn = e.target.closest('.btn-eliminar-tabla');
            const id = parseInt(btn.dataset.id, 10);
            transactions = transactions.filter((t) => t.id !== id);
            guardar();
            renderizarTabla();
        }
    });

    // ===== EDITAR (ABRIR MODAL) =====
    document.addEventListener('click', function (e) {
        if (e.target.closest('.btn-editar-tabla')) {
            const btn = e.target.closest('.btn-editar-tabla');
            const id = parseInt(btn.dataset.id, 10);
            const t = transactions.find((tr) => tr.id === id);
            if (!t) return;

            editingId = t.id;
            document.getElementById('editar-id').value = t.id;
            document.getElementById('editar-descripcion').value = t.descripcion;
            document.getElementById('editar-monto').value = t.monto;
            document.getElementById('editar-categoria').value = t.categoria;
            document.getElementById('editar-tipo').value = t.tipo;
            document.getElementById('editar-fecha').value = t.fecha;

            modal.classList.add('activo');
        }
    });

    // ===== CERRAR MODAL =====
    function cerrarModalHandler() {
        modal.classList.remove('activo');
        editingId = null;
    }

    cerrarModal.addEventListener('click', cerrarModalHandler);
    btnCancelar.addEventListener('click', cerrarModalHandler);
    modal.addEventListener('click', function (e) {
        if (e.target === modal) cerrarModalHandler();
    });

    // ===== GUARDAR EDICIÓN =====
    formEdit.addEventListener('submit', function (e) {
        e.preventDefault();

        const descripcion = document.getElementById('editar-descripcion').value.trim();
        const monto = parseFloat(document.getElementById('editar-monto').value);
        const categoria = document.getElementById('editar-categoria').value;
        const tipo = document.getElementById('editar-tipo').value;
        const fecha = document.getElementById('editar-fecha').value;

        if (!descripcion || !monto || monto <= 0) return;

        const idx = transactions.findIndex((t) => t.id === editingId);
        if (idx === -1) return;

        transactions[idx] = {
            ...transactions[idx],
            descripcion,
            monto: parseFloat(monto.toFixed(2)),
            categoria,
            tipo,
            fecha,
        };

        guardar();
        renderizarTabla();
        cerrarModalHandler();
    });

    // ===== FILTROS =====
    buscarInput.addEventListener('input', renderizarTabla);
    filtroTipo.addEventListener('change', renderizarTabla);
    filtroCategoria.addEventListener('change', renderizarTabla);
    btnOrdenFecha.addEventListener('click', function () {
        if (filtroOrdenFecha.value === 'desc') {
            filtroOrdenFecha.value = 'asc';
        } else {
            filtroOrdenFecha.value = 'desc';
        }
        filtroOrdenFecha.dispatchEvent(new Event('change'));
    });
    filtroOrdenMonto.addEventListener('change', renderizarTabla);
    btnOrdenMonto.addEventListener('click', function () {
        if (filtroOrdenMonto.value === 'none') {
            filtroOrdenMonto.value = 'desc';
        } else if (filtroOrdenMonto.value === 'desc') {
            filtroOrdenMonto.value = 'asc';
        } else {
            filtroOrdenMonto.value = 'none';
        }
        if (filtroOrdenMonto.value !== 'none') {
            btnOrdenMonto.setAttribute('data-sort-active', 'true');
        } else {
            btnOrdenMonto.removeAttribute('data-sort-active');
        }
        filtroOrdenMonto.dispatchEvent(new Event('change'));
    });

    // ===== Sincronizar estado inicial de botones de ordenamiento =====
    if (filtroOrdenFecha.value !== 'none') {
        btnOrdenFecha.setAttribute('data-sort-active', 'true');
    }
    if (filtroOrdenMonto.value !== 'none') {
        btnOrdenMonto.setAttribute('data-sort-active', 'true');
    }

    // ===== EXPORTAR CSV =====
    btnExportar.addEventListener('click', function () {
        if (transactions.length === 0) {
            alert('No hay transacciones para exportar.');
            return;
        }

        const headers = ['Tipo', 'Descripción', 'Categoría', 'Monto', 'Fecha'];
        const rows = transactions.map((t) => [
            t.tipo === 'ingreso' ? 'Ingreso' : (t.tipo === 'gasto' ? 'Gasto' : 'Deuda'),
            t.descripcion,
            t.categoria.replace(/-/g, ' '),
            t.monto.toFixed(2),
            t.fecha,
        ]);

        const csvContent =
            'data:text/csv;charset=utf-8,' +
            [headers.join(','), ...rows.map((r) => r.map((v) => `"${v}"`).join(','))].join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', 'finanzas_ibg_' + today + '.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // ===== LIMPIAR TODO =====
    btnLimpiar.addEventListener('click', function () {
        if (transactions.length === 0) return;
        if (confirm('¿Estás seguro de que deseas eliminar todas las transacciones?')) {
            transactions = [];
            nextId = 1;
            guardar();
            renderizarTabla();
        }
    });

    // ===== EXPORTAR TODO (Transacciones + Calendario de Deudas) =====
    btnExportarTodo.addEventListener('click', function () {
        if (transactions.length === 0 && debtPlans.length === 0) {
            alert('No hay datos para exportar.');
            return;
        }

        let csvContent = '';

        // Sección de Transacciones
        if (transactions.length > 0) {
            csvContent += '=== TRANSACCIONES ===\n';
            const headersTrans = ['Tipo', 'Descripción', 'Categoría', 'Monto', 'Fecha'];
            csvContent += headersTrans.join(',') + '\n';
            transactions.forEach(t => {
                csvContent += [
                    t.tipo === 'ingreso' ? 'Ingreso' : (t.tipo === 'gasto' ? 'Gasto' : 'Deuda'),
                    t.descripcion,
                    t.categoria.replace(/-/g, ' '),
                    t.monto.toFixed(2),
                    t.fecha
                ].map(v => `"${v}"`).join(',') + '\n';
            });
        }

        // Sección de Plan de Deudas
        if (debtPlans.length > 0) {
            csvContent += '\n=== CALENDARIO DE PAGOS DE DEUDAS ===\n';
            debtPlans.forEach(plan => {
                csvContent += `\n--- ${plan.nombre} ---\n`;
                const tabla = generarTablaAmortizacion(plan);
                const headersDeuda = ['Mes', 'Cuota', 'Interés', 'Amortización', 'Saldo', 'Fecha'];
                csvContent += headersDeuda.join(',') + '\n';
                tabla.forEach(row => {
                    csvContent += [
                        row.mes,
                        row.cuota.toFixed(2),
                        row.interes.toFixed(2),
                        row.amortizacion.toFixed(2),
                        row.saldo.toFixed(2),
                        row.fecha
                    ].join(',') + '\n';
                });
            });
        }

        const encodedUri = encodeURI('data:text/csv;charset=utf-8,' + csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', 'finanzas_ibg_completo_' + today + '.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    function renderizarEstadisticas() {
        // --- Promedio Mensual ---
        // Agrupar transacciones por mes (YYYY-MM)
        const grupos = {};
        transactions.forEach(t => {
            const mes = t.fecha.slice(0, 7); // "YYYY-MM"
            if (!grupos[mes]) grupos[mes] = { ingresos: 0, gastos: 0 };
            if (t.tipo === 'ingreso') grupos[mes].ingresos += t.monto;
            else if (t.tipo === 'gasto') grupos[mes].gastos += t.monto;
        });

        const meses = Object.keys(grupos);
        const numMeses = meses.length;

        let promIngreso = 0, promGasto = 0;
        if (numMeses > 0) {
            const totalIng = meses.reduce((s, m) => s + grupos[m].ingresos, 0);
            const totalGas = meses.reduce((s, m) => s + grupos[m].gastos, 0);
            promIngreso = totalIng / numMeses;
            promGasto = totalGas / numMeses;
        }

        estadisticaPromIngreso.textContent = '$' + formatearMoneda(promIngreso);
        estadisticaPromGasto.textContent  = '$' + formatearMoneda(promGasto);
        estadisticaPromBalance.textContent = '$' + formatearMoneda(promIngreso - promGasto);

        // Color del balance promedio
        if (promIngreso - promGasto >= 0) {
            estadisticaPromBalance.style.color = 'var(--accent-blue)';
        } else {
            estadisticaPromBalance.style.color = 'var(--accent-red)';
        }

        // --- Categoría con Mayor Gasto ---
        const gastosPorCat = {};
        transactions.filter(t => t.tipo === 'gasto').forEach(t => {
            gastosPorCat[t.categoria] = (gastosPorCat[t.categoria] || 0) + t.monto;
        });

        const totalGastosAll = Object.values(gastosPorCat).reduce((s, v) => s + v, 0);

        if (Object.keys(gastosPorCat).length === 0) {
            catMayorNombre.textContent = '—';
            catMayorBarra.style.width = '0%';
            catMayorBarra.style.background = 'gray';
            catMayorMonto.textContent = '$0.00';
            catMayorPct.textContent = '0%';
        } else {
            const [catTop, montoTop] = Object.entries(gastosPorCat).sort((a, b) => b[1] - a[1])[0];
            const pct = totalGastosAll > 0 ? (montoTop / totalGastosAll) * 100 : 0;

            catMayorNombre.textContent = capitalizar(catTop.replace(/-/g, ' '));
            catMayorBarra.style.width = pct.toFixed(1) + '%';
            // Gradiente verde → rojo según monto
            catMayorBarra.style.background = 'linear-gradient(90deg, #10b981, #ef4444)';
            catMayorMonto.textContent = '$' + formatearMoneda(montoTop);
            catMayorPct.textContent = pct.toFixed(1) + '%';
        }
    }

    // ===== INICIALIZACIÓN =====
    renderizarTabla();
    renderizarPlanDeudas();
    renderizarEstadisticas();

    // Navegación entre secciones
    btnHome.addEventListener('click', () => {
        seccionPlanDeudas.classList.add('hidden');
        seccionEstadisticas.classList.add('hidden');
        document.querySelector('.main-container > section.resumen').classList.remove('hidden');
        document.querySelector('.main-container > section.formulario-seccion').classList.remove('hidden');
        document.querySelector('.main-container > section.listado').classList.remove('hidden');
        btnHome.classList.add('active');
        btnDeudasPlan.classList.remove('active');
        btnEstadisticas.classList.remove('active');
    });

    btnDeudasPlan.addEventListener('click', () => {
        document.querySelector('.main-container > section.resumen').classList.add('hidden');
        document.querySelector('.main-container > section.formulario-seccion').classList.add('hidden');
        document.querySelector('.main-container > section.listado').classList.add('hidden');
        seccionEstadisticas.classList.add('hidden');
        seccionPlanDeudas.classList.remove('hidden');
        btnDeudasPlan.classList.add('active');
        btnHome.classList.remove('active');
        btnEstadisticas.classList.remove('active');
        renderizarPlanDeudas();
    });

    btnEstadisticas.addEventListener('click', () => {
        document.querySelector('.main-container > section.resumen').classList.add('hidden');
        document.querySelector('.main-container > section.formulario-seccion').classList.add('hidden');
        document.querySelector('.main-container > section.listado').classList.add('hidden');
        seccionPlanDeudas.classList.add('hidden');
        seccionEstadisticas.classList.remove('hidden');
        btnEstadisticas.classList.add('active');
        btnHome.classList.remove('active');
        btnDeudasPlan.classList.remove('active');
        renderizarEstadisticas();
    });

    // Formulario Plan de Deudas
    formularioPlan.addEventListener('submit', agregarPlanDeuda);

    // Eliminar plan (event delegation)
    planTablaBody.addEventListener('click', function(e) {
        if (e.target.closest('.btn-eliminar-plan')) {
            const btn = e.target.closest('.btn-eliminar-plan');
            const id = parseInt(btn.dataset.id, 10);
            eliminarPlan(id);
        }
    });
})();