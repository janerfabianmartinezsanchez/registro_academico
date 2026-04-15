// CONFIGURACIÓN DE FIREBASE (Uso de Compat)
const firebaseConfig = {
    apiKey: "AIzaSyAKhpkb8yl8c0aizE9vIxc0-1fHGQDmZtE",
    authDomain: "calculadoranotas-c1720.firebaseapp.com",
    projectId: "calculadoranotas-c1720",
    storageBucket: "calculadoranotas-c1720.firebasestorage.app",
    messagingSenderId: "615005343926",
    appId: "1:615005343926:web:b3290e6bd6d26e48ec1617"
};

// ==========================================
// INICIALIZACIÓN DE FIREBASE
// ==========================================
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// ==========================================
// ELEMENTOS CORE DEL DOM
// ==========================================
const subjectsGrid = document.getElementById('subjects-grid');
const addSubjectBtn = document.getElementById('add-subject-btn');
const globalScoreEl = document.getElementById('global-score');
const saveBtn = document.getElementById('save-firebase');
const searchBtn = document.getElementById('search-firebase');
const deleteBtn = document.getElementById('delete-firebase');
const printBtn = document.getElementById('print-btn');
const printAllBtn = document.getElementById('print-all-btn');
const statusMsg = document.getElementById('status-msg');

// ELEMENTOS DE AUTH
const authModal = document.getElementById('auth-modal');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const btnLogin = document.getElementById('btn-login');
const btnRegister = document.getElementById('btn-register');
const authError = document.getElementById('auth-error');
const btnLogout = document.getElementById('btn-logout');

// ==========================================
// LÓGICA DE AUTENTICACIÓN (LOGIN/REGISTER)
// ==========================================
let isCoordinatorRole = false;

// Escuchar cambios de sesión
auth.onAuthStateChanged((user) => {
    if (user) {
        // Usuario logueado: Ocultar modal de login
        authModal.style.opacity = '0';
        setTimeout(() => authModal.style.display = 'none', 400);

        // Detectar si la cuenta contiene palabras clave de administrador
        const emailLower = user.email.toLowerCase();
        isCoordinatorRole = emailLower.includes('coordi') || emailLower.includes('cordi') || emailLower.includes('admin');
        
        if (isCoordinatorRole) {
            displayStatus(`👑 MODO COORDINADOR: Modo de Solo Lectura e Impresión.`, "green");
            document.getElementById('save-firebase').style.display = 'none';
            document.getElementById('add-subject-btn').style.display = 'none';
            document.getElementById('delete-firebase').style.display = 'none';
            document.getElementById('print-btn').style.display = 'inline-block';
            printAllBtn.style.display = 'inline-block';
        } else {
            displayStatus(`Sesión de Profesor: ${user.email}`, "green");
            document.getElementById('save-firebase').style.display = 'inline-block';
            document.getElementById('add-subject-btn').style.display = 'inline-block';
            document.getElementById('delete-firebase').style.display = 'inline-block';
            document.getElementById('print-btn').style.display = 'none'; // Profesores no imprimen
            printAllBtn.style.display = 'none';
        }
    } else {
        // No hay usuario: Mostrar modal
        authModal.style.display = 'flex';
        // pequeño delay para hacer la transición css de opacidad
        setTimeout(() => authModal.style.opacity = '1', 10);
    }
});

// Función auxiliar para errores
function showAuthError(msg) {
    authError.style.display = "block";
    authError.textContent = msg;
}

// Iniciar Sesión
btnLogin.addEventListener('click', async () => {
    const e = authEmail.value;
    const p = authPassword.value;
    if(!e || !p) return showAuthError("Llena todos los campos.");
    
    btnLogin.disabled = true;
    btnLogin.textContent = "Cargando...";
    authError.style.display = "none";
    
    try {
        await auth.signInWithEmailAndPassword(e, p);
        // El onAuthStateChanged ocultará el modal arriba automáticamente
    } catch (error) {
        let errorMsg = "Error al iniciar sesión.";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            errorMsg = "Usuario o contraseña incorrectos.";
        } else if (error.code === 'auth/invalid-email') {
            errorMsg = "Correo electrónico inválido.";
        }
        showAuthError(errorMsg);
    } finally {
        btnLogin.disabled = false;
        btnLogin.textContent = "Entrar al Sistema";
    }
});

// Registrar Nuevo Profesor
btnRegister.addEventListener('click', async () => {
    const e = authEmail.value;
    const p = authPassword.value;
    if(!e || !p) return showAuthError("Llena todos los campos para registrar.");
    if(p.length < 6) return showAuthError("La contraseña debe tener al menos 6 caracteres.");
    
    btnRegister.disabled = true;
    btnRegister.textContent = "Creando...";
    authError.style.display = "none";
    
    try {
        await auth.createUserWithEmailAndPassword(e, p);
        displayStatus("¡Cuenta de profesor creada con éxito!", "green");
        // El onAuthStateChanged ocultará el modal arriba
    } catch (error) {
        let errorMsg = "Error al crear cuenta.";
        if (error.code === 'auth/email-already-in-use') {
            errorMsg = "Este correo ya está registrado.";
        } else if (error.code === 'auth/invalid-email') {
            errorMsg = "Correo electrónico inválido.";
        }
        showAuthError(errorMsg);
    } finally {
        btnRegister.disabled = false;
        btnRegister.textContent = "Crear Nueva Cuenta";
    }
});

// Cerrar Sesión
btnLogout.addEventListener('click', () => {
    auth.signOut();
    // Limpiar formulario por seguridad
    document.getElementById('clear-form-btn').click();
});

// ==========================================
// CÁLCULO GENERAL Y LOCAL (Delegación de Eventos)
// ==========================================
function calculateEverything() {
    const subjectCards = document.querySelectorAll('.subject-card');

    let sumGlobal = 0;
    let validSubjectsCount = 0;

    // Recorrer cada materia
    subjectCards.forEach(card => {
        const gradeRows = card.querySelectorAll('.grade-row');
        const subjectAvgDisplay = card.querySelector('.subject-average');

        let localSum = 0;
        let localWeight = 0;

        // Recorrer cada nota (evaluación) dentro de la materia
        gradeRows.forEach(row => {
            const grade = parseFloat(row.querySelector('.g-nota').value);
            const weightInput = row.querySelector('.g-peso').value.trim();

            // SÚPER FIX: Si el usuario NO pone un Peso %, le asignamos un peso neutro de "1".
            // De este modo, si dejan todo vacío, funcionará como un Promedio Simple tradicional.
            const weight = weightInput === "" ? 1 : parseFloat(weightInput);

            // Múltiplica Nota x Peso interno (solo si metió una nota válida)
            if (!isNaN(grade) && !isNaN(weight)) {
                localSum += (grade * weight);
                localWeight += weight;
            }
        });

        // Calculamos el promedio de ESA materia específica
        if (localWeight > 0) {
            // Dividimos entre la suma del peso actual. 
            // Si usan 30, 40, 30 dividirá entre 100. Si dejan todo vacío, dividirá entre la cantidad de notas. 
            // ¡Ambos escenarios dan resultados perfectos!
            const localAvg = localSum / localWeight;
            subjectAvgDisplay.textContent = localAvg.toFixed(2);

            // Sumamos esta materia al conteo global (Simple Average entre materias)
            sumGlobal += localAvg;
            validSubjectsCount++;
        } else {
            subjectAvgDisplay.textContent = "-";
        }
    });

    // Calculamos el PROMEDIO GLOBAL FINAL
    if (validSubjectsCount > 0) {
        const globalAvg = sumGlobal / validSubjectsCount;
        globalScoreEl.textContent = globalAvg.toFixed(2);
    } else {
        globalScoreEl.textContent = "-";
    }
}

// 1. EVENT DELEGATION GLOBAL: Cualquier edición en inputs dispara cálculos
subjectsGrid.addEventListener('input', (e) => {
    if (e.target.classList.contains('g-nota') || e.target.classList.contains('g-peso')) {
        calculateEverything();
    }
});

// 2. EVENT DELEGATION GLOBAL: Botones de jerarquía dinámica (Agregar/Borrar Notas o Materias)
subjectsGrid.addEventListener('click', (e) => {

    // Acción: Añadir Evaluación (Fila) en una materia existente
    if (e.target.closest('.btn-add-grade')) {
        const gradesList = e.target.closest('.subject-card').querySelector('.grades-list');
        gradesList.appendChild(createGradeRow("Nueva Evaluación"));
    }

    // Acción: Borrar una Evaluación Específica
    if (e.target.closest('.delete-grade-btn')) {
        const gradeRow = e.target.closest('.grade-row');
        // Efecto salida
        gradeRow.style.opacity = '0';
        gradeRow.style.transform = 'translateX(20px)';
        setTimeout(() => {
            gradeRow.remove();
            calculateEverything();
        }, 200);
    }

    // Acción: Borrar toda la Tarjeta de la Materia
    if (e.target.closest('.delete-subject-btn')) {
        if (confirm("¿Seguro que quieres borrar toda esta materia y sus notas?")) {
            const card = e.target.closest('.subject-card');
            card.style.opacity = '0';
            card.style.transform = 'scale(0.9)';
            setTimeout(() => {
                card.remove();
                calculateEverything();
            }, 300);
        }
    }
});

// ==========================================
// GENERADORES DE COMPONENTES UI (DOM Módulo)
// ==========================================
function createGradeRow(placeholderText = "Ej. Parcial") {
    const row = document.createElement('div');
    row.classList.add('grade-row');
    row.innerHTML = `
        <input type="text" class="g-name" placeholder="${placeholderText}">
        <input type="number" class="g-nota" placeholder="Nota" min="0" max="100" step="0.1">
        <input type="number" class="g-peso" placeholder="Peso %" min="0" max="100">
        <button class="delete-grade-btn" title="Eliminar Evaluación">✖</button>
    `;

    // Micro-interacción de entrada
    row.style.opacity = '0';
    row.style.transform = 'translateY(-10px)';
    row.style.transition = 'all 0.3s ease';
    setTimeout(() => {
        row.style.opacity = '1';
        row.style.transform = 'translateY(0)';
    }, 10);

    return row;
}

function addSubjectCard() {
    const card = document.createElement('div');
    card.classList.add('subject-card');

    card.innerHTML = `
        <div class="subject-header">
            <input type="text" class="subject-name-input" placeholder="Nombre de la Materia">
            <div class="subject-average">-</div>
            <button class="delete-subject-btn">Borrar Materia</button>
        </div>
        <div class="grades-list">
            <!-- La primera Evaluación vacía inyectada enseguida -->
        </div>
        <textarea class="subject-logros" placeholder="Escriba los logros, observaciones o recomendaciones para el estudiante en esta materia..."></textarea>
        <button class="btn btn-add-grade">➕ Añadir Evaluación</button>
    `;

    // Insertamos 3 filas por defecto inmediatamente como mínimo
    const gradesList = card.querySelector('.grades-list');
    gradesList.appendChild(createGradeRow("Parcial 1"));
    gradesList.appendChild(createGradeRow("Parcial 2"));
    gradesList.appendChild(createGradeRow("Parcial 3"));

    // Animación Premium
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';

    subjectsGrid.appendChild(card);

    setTimeout(() => {
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
    }, 50);
}

// Botón Azul Superior (Nueva Materia General)
addSubjectBtn.addEventListener('click', addSubjectCard);


// ==========================================
// FIREBASE CLOUD DATABASE - Guardado
// ==========================================

function displayStatus(msg, type) {
    statusMsg.style.display = "block";
    statusMsg.style.background = type === "green" ? "rgba(74, 222, 128, 0.1)" : "rgba(248, 113, 113, 0.1)";
    statusMsg.style.color = type === "green" ? "#4ade80" : "#f87171";
    statusMsg.style.border = `1px solid ${type === "green" ? "rgba(74, 222, 128, 0.5)" : "rgba(248, 113, 113, 0.5)"}`;
    statusMsg.textContent = msg;

    setTimeout(() => {
        statusMsg.style.opacity = '0';
        setTimeout(() => {
            statusMsg.style.display = 'none';
            statusMsg.style.opacity = '1';
        }, 300);
    }, 4500);
}

saveBtn.addEventListener('click', async () => {
    // 1. Recoger metadata del estudiante
    const carnet = document.getElementById('student-carnet').value.trim();
    const name = document.getElementById('student-name').value.trim();
    const room = document.getElementById('student-room').value.trim();

    if (!carnet || !name) {
        displayStatus("Falta escribir el ID/Carnet o el Nombre del estudiante.", "red");
        return;
    }

    const payloadMaterias = [];
    let containsValidData = false;

    // 2. Anidar Estructura: Extraer de Tarjetas (Materias) -> Y después sus Filas (Evaluaciones)
    document.querySelectorAll('.subject-card').forEach(card => {
        const matName = card.querySelector('.subject-name-input').value.trim() || 'Materia Sin Título';
        const matAvgText = card.querySelector('.subject-average').textContent;
        const matAvg = matAvgText === '-' ? 0 : parseFloat(matAvgText);
        const matLogros = card.querySelector('.subject-logros').value.trim();

        const evaluations = [];

        card.querySelectorAll('.grade-row').forEach(row => {
            const evalName = row.querySelector('.g-name').value.trim() || 'Evaluación';
            const grade = parseFloat(row.querySelector('.g-nota').value);
            const weight = parseFloat(row.querySelector('.g-peso').value);

            if (!isNaN(grade) && !isNaN(weight)) {
                containsValidData = true;
                evaluations.push({
                    nombreEv: evalName,
                    nota: grade,
                    peso: weight
                });
            }
        });

        // Solo guardamos la materia si tiene al menos 1 nota rellenada válida
        if (evaluations.length > 0) {
            payloadMaterias.push({
                nombreMateria: matName,
                promedioMateria: matAvg,
                logros: matLogros,
                evaluaciones: evaluations
            });
        }
    });

    if (!containsValidData) {
        displayStatus("No hay notas ingresadas para guardar. Añade materias y calificaciones.", "red");
        return;
    }

    const globalScoreText = globalScoreEl.textContent;
    const globalScore = globalScoreText === '-' ? 0 : parseFloat(globalScoreText);

    // UX Status Loading
    saveBtn.disabled = true;
    saveBtn.style.opacity = "0.7";
    saveBtn.innerHTML = "⏳ Enviando a Firebase...";

    try {
        const userUid = auth.currentUser.uid;
        
        // Petición a Firebase con Privacidad (MERGE TRUE)
        const dbRequest = db.collection("expedientes").doc(carnet).set({
            carnetID: carnet,
            estudiante: name,
            salon: room,
            fechaRegistro: firebase.firestore.FieldValue.serverTimestamp(),
            materiasPorProfesor: {
                [userUid]: payloadMaterias
            }
        }, { merge: true });

        // Timeout preventivo de 8 segundos por si la base de datos no está activada en la consola
        const timeoutRequest = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Firebase no responde (timeout).")), 8000)
        });

        // La carrera: Quien termine primero. Si Firebase tarda más de 8s, dispara el catch de error.
        await Promise.race([dbRequest, timeoutRequest]);

        displayStatus("¡Expediente almacenado correctamente en Firebase!", "green");

        // EFECTO VISUAL EN EL BOTÓN DIRECTO (Para que sea súper obvio que funcionó)
        saveBtn.style.background = "#10b981"; // Verde intenso
        saveBtn.innerHTML = "✔️ ¡Guardado Exitoso!";
        setTimeout(() => {
            saveBtn.style.background = ""; // Regresa a css original
            saveBtn.innerHTML = "💾 Guardar Expediente";
        }, 4500);

    } catch (error) {
        console.error("Error Firebase:", error);
        displayStatus("Error de nube. Verifica tu consola, o permisos de base de datos.", "red");

        // Efecto visual de ERROR en el botón
        saveBtn.style.background = "#ef4444"; // Rojo error
        saveBtn.innerHTML = "❌ Error (Revisa Firebase)";
        setTimeout(() => {
            saveBtn.style.background = "";
            saveBtn.innerHTML = "💾 Guardar Expediente";
        }, 4500);

    } finally {
        // Liberar botón
        saveBtn.disabled = false;
        saveBtn.style.opacity = "1";
    }
});

// ==========================================
// FIREBASE CLOUD DATABASE - Buscar (Read)
// ==========================================

searchBtn.addEventListener('click', async () => {
    const carnet = document.getElementById('student-carnet').value.trim();
    if (!carnet) {
        displayStatus("Por favor, ingresa el ID/Carnet del estudiante a buscar.", "red");
        return;
    }

    searchBtn.disabled = true;
    searchBtn.innerHTML = "⏳ Buscando...";

    try {
        const docRef = db.collection("expedientes").doc(carnet);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            const data = docSnap.data();

            // 1. Cargar nombre del estudiante y salón
            document.getElementById('student-name').value = data.estudiante || "";
            document.getElementById('student-room').value = data.salon || "";

            // 2. Limpiar las materias actuales del DOM
            subjectsGrid.innerHTML = "";

            // LÓGICA DE PRIVACIDAD: Determinar rol y obtener materias
            let asignaturasALoad = [];
            const userUid = auth.currentUser.uid;
            
            if (isCoordinatorRole) {
                // Coordinador extrae TODAS las colecciones sub-anidadas!
                if (data.materiasPorProfesor) {
                    Object.values(data.materiasPorProfesor).forEach(profMaterias => {
                        asignaturasALoad = asignaturasALoad.concat(profMaterias);
                    });
                } else if (data.asignaturas) {
                    // Soporte retroactivo para alumnos subidos antes del parche
                    asignaturasALoad = data.asignaturas;
                }
            } else {
                // Profesor Normal: Solo carga lo Suyo
                if (data.materiasPorProfesor && data.materiasPorProfesor[userUid]) {
                    asignaturasALoad = data.materiasPorProfesor[userUid];
                }
            }

            // 3. Recrear las materias en el DOM
            if (asignaturasALoad && asignaturasALoad.length > 0) {
                asignaturasALoad.forEach(materia => {
                    const card = document.createElement('div');
                    card.classList.add('subject-card');
                    card.innerHTML = `
                        <div class="subject-header">
                            <input type="text" class="subject-name-input" value="${materia.nombreMateria}">
                            <div class="subject-average">${materia.promedioMateria ? materia.promedioMateria.toFixed(2) : '-'}</div>
                            <button class="delete-subject-btn">Borrar Materia</button>
                        </div>
                        <div class="grades-list"></div>
                        <textarea class="subject-logros" placeholder="Escriba los logros, observaciones o recomendaciones para el estudiante en esta materia..."></textarea>
                        <button class="btn btn-add-grade">➕ Añadir Evaluación</button>
                    `;
                    
                    // Colocar observaciones recuperadas
                    if(materia.logros) {
                        card.querySelector('.subject-logros').value = materia.logros;
                    }

                    const gradesList = card.querySelector('.grades-list');
                    if (materia.evaluaciones && materia.evaluaciones.length > 0) {
                        materia.evaluaciones.forEach(ev => {
                            const row = createGradeRow(ev.nombreEv.includes('Ej.') ? ev.nombreEv : "Evaluación");
                            row.querySelector('.g-name').value = ev.nombreEv;
                            row.querySelector('.g-nota').value = ev.nota;
                            row.querySelector('.g-peso').value = ev.peso;

                            // Remover la animación inicial de entrada para que no salten todas a la vez bruscas
                            row.style.opacity = '1';
                            row.style.transform = 'translateY(0)';

                            gradesList.appendChild(row);
                        });
                    } else {
                        gradesList.appendChild(createGradeRow("Parcial 1"));
                    }

                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                    subjectsGrid.appendChild(card);
                });
            } else {
                addSubjectCard();
            }

            // 4. Recalcular globales si es necesario
            calculateEverything();
            displayStatus("¡Expediente cargado con éxito!", "green");

        } else {
            displayStatus("No se encontró ningún expediente con este número de Carnet.", "red");
        }
    } catch (error) {
        console.error("Error al buscar el expediente:", error);
        displayStatus("Error consultando la nube. Revisa la consola.", "red");
    } finally {
        searchBtn.disabled = false;
        searchBtn.innerHTML = "🔍 Buscar";
    }
});

// ==========================================
// FIREBASE CLOUD DATABASE - Eliminar (Delete)
// ==========================================

deleteBtn.addEventListener('click', async () => {
    const carnet = document.getElementById('student-carnet').value.trim();
    if (!carnet) {
        displayStatus("Primero carga o escribe el Carnet del estudiante a eliminar.", "red");
        return;
    }

    if (!confirm(`¿Estás completamente seguro de que deseas ELIMINAR el expediente de "${carnet}" de Firebase? Esta acción es irreversible.`)) {
        return; // Cancelado por el usuario
    }

    deleteBtn.disabled = true;
    deleteBtn.innerHTML = "⏳ Borrando...";

    try {
        await db.collection("expedientes").doc(carnet).delete();
        displayStatus("¡Expediente eliminado de la base de datos!", "green");

        // Simular clic en el botón de "Limpiar Todo" para resetear la pantalla
        document.getElementById('student-carnet').value = "";
        document.getElementById('student-name').value = "";
        subjectsGrid.innerHTML = "";
        addSubjectCard();
        calculateEverything();

    } catch (error) {
        console.error("Error al eliminar:", error);
        displayStatus("Error borrando el expediente en la nube.", "red");
    } finally {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = "🗑️ Eliminar";
    }
});

// ==========================================
// LIMPIAR FORMULARIO (Nuevo Estudiante)
// ==========================================
const clearBtn = document.getElementById('clear-form-btn');
clearBtn.addEventListener('click', () => {
    if (confirm("¿Seguro que deseas limpiar todo para ingresar a un nuevo estudiante? (Esto no borra lo que ya se subió a la nube)")) {
        // 1. Vaciar Cabecera
        document.getElementById('student-carnet').value = "";
        document.getElementById('student-name').value = "";

        // 2. Destruir todas las materias creadas en la cuadrícula
        subjectsGrid.innerHTML = "";

        // 3. Volver a crear una tarjeta nueva limpia por defecto
        addSubjectCard();

        // 4. Forzar un recálculo para que el Número Azul se convierta en un guion "-"
        calculateEverything();
    }
});

// ==========================================
// ARRANQUE DE LA APP
// ==========================================
// Iniciar con 1 asignatura vacía por defecto de muestra
addSubjectCard();

// ==========================================
// ATAJOS DE TECLADO (Shortcuts)
// ==========================================
document.addEventListener('keydown', (e) => {
    // Si presiona Ctrl + S (Windows/Linux) o Cmd + S (Mac)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault(); // Evita que se abra el diálogo de guardar página html nativo del navegador
        saveBtn.click(); // Dispara el click en el botón de guardar
    }
});

// ==========================================
// MODAL DE DIRECTORIO DE ESTUDIANTES
// ==========================================
const directoryBtn = document.getElementById('directory-btn');
const directoryModal = document.getElementById('directory-modal');
const closeDirectoryBtn = document.getElementById('close-directory');
const directoryTbody = document.getElementById('directory-tbody');
const directoryLoading = document.getElementById('directory-loading');

directoryBtn.addEventListener('click', async () => {
    // Mostrar modal
    directoryModal.classList.add('show');
    directoryTbody.innerHTML = "";
    directoryLoading.style.display = "block";
    directoryLoading.textContent = "Obteniendo datos de Firebase...";

    try {
        const querySnapshot = await db.collection("expedientes").orderBy("fechaRegistro", "desc").get();
        directoryLoading.style.display = "none";

        if (querySnapshot.empty) {
            directoryLoading.style.display = "block";
            directoryLoading.textContent = "No hay ningún estudiante registrado aún.";
            return;
        }

        const userUid = auth.currentUser.uid;

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            
            let tieneMisMaterias = false;
            let sumaPromedios = 0;
            let conteoPromedios = 0;

            // Recopilar totales desde namespace de seguridad
            if (data.materiasPorProfesor) {
                if (data.materiasPorProfesor[userUid] || isCoordinatorRole) {
                    tieneMisMaterias = true;
                }
                
                Object.values(data.materiasPorProfesor).forEach(profMaterias => {
                    profMaterias.forEach(mat => {
                        sumaPromedios += mat.promedioMateria;
                        conteoPromedios++;
                    });
                });
            } else if (data.asignaturas) { 
                // Retrocompatibilidad
                tieneMisMaterias = true;
                data.asignaturas.forEach(mat => {
                    sumaPromedios += mat.promedioMateria;
                    conteoPromedios++;
                });
            }

            // PROTECCION DIRECTORIO: Si no es de este profe y NO es coordinador, lo escondemos!
            if (!tieneMisMaterias && !isCoordinatorRole) return;

            const promedioFinal = conteoPromedios > 0 ? (sumaPromedios / conteoPromedios).toFixed(2) : '-';
            
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td><strong>${data.carnetID}</strong></td>
                <td>${data.estudiante || "Sin nombre"}</td>
                <td>${data.salon || "-"}</td>
                <td style="color: var(--accent-primary); font-weight: bold;">
                    ${promedioFinal}
                </td>
                <td>
                    <button class="btn-load" data-id="${data.carnetID}">📂 Cargar</button>
                </td>
            `;
            directoryTbody.appendChild(row);
        });

        // Adjuntar eventos a los botones de "Cargar"
        const loadButtons = directoryTbody.querySelectorAll('.btn-load');
        loadButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idToLoad = e.target.getAttribute('data-id');
                // Poner ID en el input
                document.getElementById('student-carnet').value = idToLoad;
                // Disparar el botón buscar
                searchBtn.click();
                // Cerrar modal
                directoryModal.classList.remove('show');
            });
        });

    } catch (error) {
        console.error("Error cargando directorio:", error);
        directoryLoading.style.display = "block";
        directoryLoading.textContent = "Error al cargar la lista. Verifica la consola.";
    }
});

// Cerrar Modal con la X o cliqueando afuera
closeDirectoryBtn.addEventListener('click', () => {
    directoryModal.classList.remove('show');
});

directoryModal.addEventListener('click', (e) => {
    if (e.target === directoryModal) {
        directoryModal.classList.remove('show');
    }
});

// Imprimir Reporte Individual usando el Motor Estático Flawless
printBtn.addEventListener('click', () => {
    // 1. Recolectar datos actuales de la pantalla
    const carnet = document.getElementById('student-carnet').value.trim() || 'No especificado';
    const name = document.getElementById('student-name').value.trim() || '';
    const room = document.getElementById('student-room').value.trim() || '';
    const pGlobalText = document.getElementById('global-score').textContent;
    
    const payloadMaterias = [];
    document.querySelectorAll('#subjects-grid .subject-card').forEach(card => {
        const matName = card.querySelector('.subject-name-input').value.trim() || 'Sin Título';
        const matAvgText = card.querySelector('.subject-average').textContent;
        const matLogros = card.querySelector('.subject-logros').value.trim();
        const matAvg = matAvgText === '-' ? 0 : parseFloat(matAvgText);
        
        const evaluations = [];
        card.querySelectorAll('.grade-row').forEach(row => {
            const evalName = row.querySelector('.g-name').value.trim() || 'Ev.';
            const grade = parseFloat(row.querySelector('.g-nota').value);
            const weight = parseFloat(row.querySelector('.g-peso').value);
            if (!isNaN(grade) && !isNaN(weight)) {
                evaluations.push({ nombreEv: evalName, nota: grade, peso: weight });
            }
        });
        
        payloadMaterias.push({
            nombreMateria: matName,
            promedioMateria: matAvg,
            logros: matLogros,
            evaluaciones: evaluations
        });
    });

    // 2. Generar código HTML Estático Duro
    const htmlBatch = generateStudentHTML(carnet, name, room, pGlobalText, payloadMaterias);

    // 3. Ocultar la app interactiva y mostrar el Documento
    const batchContainer = document.getElementById('batch-print-container');
    document.getElementById('dashboard-normal').style.display = 'none';
    batchContainer.innerHTML = htmlBatch;
    batchContainer.style.display = 'block';
    
    // 4. Mandar impresión nativa
    window.print();

    // 5. Restaurar instantáneamente la app interactiva
    batchContainer.innerHTML = "";
    batchContainer.style.display = 'none';
    document.getElementById('dashboard-normal').style.display = 'block';
});

// Funciòn de Plantilla para Impresiòn Masiva
function generateStudentHTML(carnet, name, room, promedioGlobal, asignaturas) {
    let subjectsHTML = '';
    asignaturas.forEach(m => {
        let rowsHTML = '';
        if(m.evaluaciones){
            m.evaluaciones.forEach(ev => {
               rowsHTML += `
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #ddd; padding: 4px 0;">
                    <span style="flex:2; font-family: 'Times New Roman', serif;">${ev.nombreEv}</span>
                    <span style="flex:1; text-align:center; font-family: 'Times New Roman', serif;">${ev.nota}</span>
                    <span style="flex:1; text-align:center; font-family: 'Times New Roman', serif;">${ev.peso}%</span>
                </div>`;
            });
        }

        subjectsHTML += `
        <div style="border: 1px solid black; padding: 15px; margin-bottom: 15px; page-break-inside: avoid;">
            <div style="border-bottom: 1px solid black; padding-bottom: 10px; margin-bottom: 10px; display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; font-family: 'Times New Roman', serif; font-size: 22px;">${m.nombreMateria}</h3>
                <strong style="font-size: 24px;">${m.promedioMateria ? m.promedioMateria.toFixed(2) : '-'}</strong>
            </div>
            <div style="margin-bottom: 10px;">
                ${rowsHTML}
            </div>
            <div style="border-top: 1px solid black; margin-top: 5px; padding-top: 5px; font-style: italic; font-family: 'Times New Roman', serif;">
                ${m.logros || 'Sin observaciones.'}
            </div>
        </div>`;
    });

    return `
    <div class="batch-student" style="padding: 0; box-sizing: border-box; font-family: 'Times New Roman', serif;">
        <div style="display:block; text-align:center; margin-bottom: 30px; border-bottom: 3px double black; padding-bottom: 15px;">
            <h1 style="margin: 0; font-size: 28px; text-transform: uppercase; letter-spacing: 2px;">Colegio Internacional Mayor</h1>
            <p style="margin: 5px 0 0 0; font-style: italic; color: #444;">Boletín Oficial de Calificaciones del Periodo</p>
        </div>
        
        <div style="display: flex; flex-direction:column; align-items: center; margin-bottom: 20px;">
            <p style="font-size: 18px; margin: 5px 0;"><strong>Doc. Identidad / Carnet: </strong> <span style="font-size:20px;">${carnet}</span></p>
            <p style="font-size: 18px; margin: 5px 0;"><strong>Nombre del Estudiante: </strong> <span style="font-size:20px;">${name || '..............................'}</span></p>
            <p style="font-size: 18px; margin: 5px 0;"><strong>Grado / Salón: </strong> <span style="font-size:20px;">${room || '..............................'}</span></p>
            
            <div style="border: 2px solid black; padding: 10px 30px; border-radius: 8px; text-align:center; margin-top: 10px;">
                <p style="margin: 0; font-size: 14px;">Promedio Final del Alumno</p>
                <h2 style="margin: 5px 0 0 0; font-size: 42px;">${promedioGlobal}</h2>
            </div>
        </div>

        <div style="display:block;">
            ${subjectsHTML}
        </div>
        
        <div style="display:flex; justify-content:space-around; margin-top: 60px; page-break-inside: avoid;">
            <div style="width:40%; text-align:center;">
                <hr style="border-top: 1px solid black; margin-bottom: 10px;">
                <p style="margin:0;"><strong>Firma del Docente</strong></p>
                <p style="margin:0; font-size:12px;">Confirmación de calificaciones</p>
            </div>
            <div style="width:40%; text-align:center;">
                <hr style="border-top: 1px solid black; margin-bottom: 10px;">
                <p style="margin:0;"><strong>Firma del Acudiente / Padre</strong></p>
                <p style="margin:0; font-size:12px;">Recibido conforme</p>
            </div>
        </div>
    </div>`;
}

// Imprimir Todo el Colegio (Masivo)
printAllBtn.addEventListener('click', async () => {
    printAllBtn.disabled = true;
    printAllBtn.innerHTML = "⏳ Extrayendo datos...";
    
    try {
        const querySnapshot = await db.collection("expedientes").orderBy("fechaRegistro", "desc").get();
        let htmlBatch = "";
        
        querySnapshot.forEach(doc => {
            const data = doc.data();
            let asignaturas = [];
            let suma = 0, conteo = 0;
            
            if (data.materiasPorProfesor) {
                Object.values(data.materiasPorProfesor).forEach(prof => {
                    asignaturas = asignaturas.concat(prof);
                    prof.forEach(m => {suma += m.promedioMateria; conteo++;});
                });
            } else if (data.asignaturas) {
                asignaturas = data.asignaturas;
                asignaturas.forEach(m => {suma += m.promedioMateria; conteo++;});
            }
            
            if(asignaturas.length > 0) {
               const pFinal = conteo > 0 ? (suma/conteo).toFixed(2) : '-';
               htmlBatch += generateStudentHTML(data.carnetID, data.estudiante, data.salon, pFinal, asignaturas);
            }
        });
        
        if (htmlBatch === "") {
             displayStatus("No hay alumnos con notas para imprimir.", "red");
             return;
        }

        // Intercambiar DOM
        document.getElementById('dashboard-normal').style.display = 'none';
        const batchContainer = document.getElementById('batch-print-container');
        batchContainer.innerHTML = htmlBatch;
        batchContainer.style.display = 'block';
        
        // Lanzar Impresión
        window.print();
        
        // Restaurar DOM Original Inmediatamente Después
        batchContainer.innerHTML = "";
        batchContainer.style.display = 'none';
        document.getElementById('dashboard-normal').style.display = 'block';

    } catch(err) {
        console.error(err);
        displayStatus("Error generando PDF masivo.", "red");
    } finally {
        printAllBtn.disabled = false;
        printAllBtn.innerHTML = "🖨️ Imprimir Todo El Colegio";
    }
});
