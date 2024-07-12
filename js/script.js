let currentShiftId = null;
const pageSize = 10; // Liczba rekordów na stronę w liście andonów
let allData = []; // Przechowuje wszystkie dane do wyświetlenia listy andonów
let startDateForQuery = null;
let endDateForQuery = null;
const selectMDO = 'link to select MDO query in sap MII workbench';
const insertMDO = 'link to insert MDO query in sap MII workbench';
const updateMDO = 'link to update MDO query in sap MII workbench';
const checkIfWorkCenterExistsQuery = `link to fixed sql query in sap MII workbench to check if workcenter exists in database`;
const producedUnitsByWc = `link to fixed sql query in sap MII workbench to check produced units in database`;

// ------------------------------------------------------------------------------- Skrypty do edytowania andona -----------------------------------------------------------------------------------

function initEditPage() {
    loadMenu(); // Ładowanie menu
    populateFormFromParams(); // Wypełnienie formularza z parametrów URL
}


function populateFormFromParams() {
    workStation = getValueFromUrl('workStation');
    document.getElementById('workStation').value = workStation;
    document.getElementById('workStation').readOnly = true;
    fillFormFromServer(workStation);
}


function getValueFromUrl(variable) {
    const urlParams = new URLSearchParams(window.location.search);
    const retrieviedVariable = urlParams.get(variable);
    return retrieviedVariable;
}


// ------------------------------------------------------------------------------- Skrypty do tworzenia andona -----------------------------------------------------------------------------------


function initCreatePage() {
    fetchDataAndPopulateSelect();
    document.getElementById('workStationTemplate').addEventListener('change', function (event) {
        const selectedWorkStation = event.target.value;
        fillFormFromServer(selectedWorkStation);
    });
    loadMenu();
}


function fetchDataAndPopulateSelect() {
    fetch(selectMDO)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json(); // Parsowanie odpowiedzi jako JSON
        })
        .then(data => {
            // Przetwarzanie otrzymanych danych
            const rowset = data.Rowsets.Rowset[0]; // Zakładam, że interesują nas dane z pierwszego Rowsetu

            // Pobieranie menu rozwijanego
            const select = document.getElementById('workStationTemplate');

            // Usunięcie istniejących opcji (jeśli są)
            select.innerHTML = '';

            // Dodanie opcji do menu rozwijanego na podstawie danych
            rowset.Row.forEach(row => {
                const option = document.createElement('option');
                option.value = row.workStation; // Wartość opcji
                option.textContent = `${row.workStation} - ${row.description}`; // Tekst opcji
                select.appendChild(option); // Dodanie opcji do menu rozwijanego
            });
        })
        .catch(error => {
            console.error('Fetch error:', error);
            // Obsługa błędów, np. wyświetlenie komunikatu użytkownikowi
            alert('Wystąpił błąd podczas pobierania danych. Spróbuj ponownie później.');
        });
}


async function fillFormFromServer(workStation) {
    
    try {
        const data = await fetchData(selectMDO);
        const rows = extractRows(data);
        if (rows) {
            const foundRow = findRow(rows, workStation);
            if (foundRow) {
                fillForm(foundRow);
                setShiftVisibility(foundRow);
            } else {
                console.error('Nie znaleziono danych dla workStation:', workStation);
            }
        } else {
            console.error('Nieprawidłowa odpowiedź JSON z serwera.');
        }
    } catch (error) {
        console.error('Błąd pobierania danych z serwera:', error);
    }
}


async function fetchData(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    return response.json();
}


function extractRows(data) {
    const rowsets = data.Rowsets;
    return rowsets && rowsets.Rowset && rowsets.Rowset.length > 0 && rowsets.Rowset[0].Row ? rowsets.Rowset[0].Row : null;
}


function findRow(rows, workStation) {
    return rows.find(row => row.workStation === workStation);
}


function fillForm(foundRow) {
    Object.keys(foundRow).forEach(key => {
        const value = foundRow[key];
        if (key === 'workStation') {
            document.getElementById('workStation').value = value || '';
        } else if (key === 'description') {
            document.getElementById('description').value = value || '';
        } else if (value === "NA") {
            if (key.endsWith('Quantity')) {
                document.getElementById(key).value = '0';
            } else if (key.endsWith('Start') || key.endsWith('End') || key.includes('Break')) {
                setValidTimeValue(key, '00:00');
            }
        } else {
            if (key.endsWith('Quantity')) {
                document.getElementById(key).value = value || '';
            } else {
                setValidTimeValue(key, value || '');
            }
        }
    });
}


function setShiftVisibility(foundRow) {
    ['secondShift', 'thirdShift'].forEach(shift => {
        const shiftCheckbox = document.getElementById(`${shift}Checkbox`);
        const shiftSection = document.getElementById(`${shift}Section`);
        const shiftStart = foundRow[`${shift}Start`];
        const shiftEnd = foundRow[`${shift}End`];

        if (shiftStart && shiftEnd) {
            shiftCheckbox.checked = true;
            setValidTimeValue(`${shift}Start`, shiftStart);
            setValidTimeValue(`${shift}End`, shiftEnd);
            for (let i = 1; i <= 3; i++) {
                setValidTimeValue(`${shift}Break${i}Start`, foundRow[`${shift}Break${i}Start`] || '00:00');
                setValidTimeValue(`${shift}Break${i}End`, foundRow[`${shift}Break${i}End`] || '00:00');
            }
            shiftSection.style.display = 'block';
        } else {
            shiftCheckbox.checked = false;
            shiftSection.style.display = 'none';
        }
    });
}


function setValidTimeValue(key, value) {
    document.getElementById(key).value = value;
}


function setValidTimeValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (value && isValidTime(value)) {
        element.value = value;
    } else {
        element.value = ''; // lub inna wartość domyślna w razie potrzeby
    }
}


function isValidTime(time) {
    // Sprawdź, czy czas jest równy "NA"
    if (time === "NA") {
        return false; // lub true, zależy od logiki Twojej aplikacji
    }

    // Format czasu HH:mm
    const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;

    // Sprawdź czy czas pasuje do formatu HH:mm
    return regex.test(time);
}


async function validateForm(event, formClass) {
    event.preventDefault(); // Prevent the form from submitting normally
    const formData = {};
    let link;

    if (formClass === ".productionForm") {
        link = insertMDO;
        // Sprawdzenie numeru stanowiska
        const isValidWorkStation = await validateWorkStation();

        if (!isValidWorkStation) {
            showConfirmation('Nie można wysłać formularza. Popraw błędy i spróbuj ponownie.');
            return false; // Prevent form submission if work station is invalid
        }
    } else {
        link = updateMDO;
    }

    const inputs = document.querySelectorAll(formClass + ' input');
    let hasErrors = false;

    let requiredFields = [
        'workStation', 'description', 'firstShiftStart', 'firstShiftEnd', 'firstShiftQuantity'
    ];

    // Check if second shift is enabled
    const secondShiftCheckbox = document.getElementById('secondShiftCheckbox');
    if (secondShiftCheckbox.checked) {
        requiredFields = requiredFields.concat(['secondShiftStart', 'secondShiftEnd', 'secondShiftQuantity']);
    }

    // Check if third shift is enabled
    const thirdShiftCheckbox = document.getElementById('thirdShiftCheckbox');
    if (thirdShiftCheckbox.checked) {
        requiredFields = requiredFields.concat(['thirdShiftStart', 'thirdShiftEnd', 'thirdShiftQuantity']);
    }

    inputs.forEach(input => {
        const key = input.id;
        const value = input.value.trim(); // Trim whitespace from input value

        // Skip checkboxes and non-required fields
        if (key !== "thirdShiftCheckbox" && key !== "secondShiftCheckbox") {
            // Check if input is required
            if (requiredFields.includes(key)) {
                // Validate if input is empty
                if (value === '') {
                    input.classList.add('is-invalid');
                    hasErrors = true;
                } else {
                    input.classList.remove('is-invalid');
                }
            }
            formData[key] = value;
        }
    });

    if (!hasErrors) {
        sendDataToMDO(formData, link);
    } else {
        showConfirmation('Nie można wysłać formularza. Popraw błędy i spróbuj ponownie.');
    }

    return !hasErrors; // Prevent form submission if there are errors
}


async function validateWorkStation() {
    const workStationInput = document.getElementById('workStation');
    const workStationError = document.getElementById('workStationError');
    const value = workStationInput.value;

    // Resetowanie stanu
    workStationError.textContent = '';
    workStationInput.classList.remove('is-invalid');
    workStationInput.classList.remove('is-valid');
    workStationError.classList.remove('success-message');

    // Sprawdzenie czy input jest pusty
    if (value === '') {
        return true; // Nie wykonujemy dalszych sprawdzeń, jeśli input jest pusty
    }

    let valid = true;

    // Sprawdzenie czy numer zaczyna się od 16 i czy ma 8 cyfr
    if (!value.startsWith('16')) {
        workStationError.textContent = 'Numer stanowiska powinien rozpoczynać się od 16.';
        workStationInput.classList.add('is-invalid');
        valid = false;
    }

    // Sprawdzenie czy numer składa się z 8 cyfr
    if (value.length !== 8) {
        if (workStationError.textContent) {
            workStationError.textContent += ' ';
        }
        workStationError.textContent += 'Numer stanowiska powinien zawierać 8 cyfr.';
        workStationInput.classList.add('is-invalid');
        valid = false;
    }
    else {
        // Sprawdzenie istnienia stanowiska w SAP ME
        const existsInSAPME = await checkIfWorkCenterExists(value);
        if (existsInSAPME) {
            workStationError.textContent = 'Stanowisko robocze istnieje w SAP ME.';
            workStationError.classList.add('success-message'); 
            workStationInput.classList.add('is-valid');
        } else {
            workStationError.textContent = 'Brak stanowiska roboczego w SAP ME.';
            workStationError.classList.remove('success-message'); 
            workStationInput.classList.add('is-invalid');
            valid = false;
        }

        // Sprawdzenie istnienia Andonu dla podanego stanowiska
        const andonExists = await checkIfAndonExists(value);
        if (andonExists) {
            workStationError.textContent = 'Andon dla podanego stanowiska roboczego już istnieje.';
            workStationError.classList.remove('success-message'); // Usuń klasę success-message
            workStationInput.classList.add('is-invalid');
            valid = false;
        }
    }

    return valid;
}


async function checkIfAndonExists(workStation) {

    try {
        const response = await fetch(selectMDO);
        const textData = await response.text();

        try {
            const jsonData = JSON.parse(textData);

            // Sprawdzanie, czy dane zawierają oczekiwane właściwości
            const rows = jsonData?.Rowsets?.Rowset?.[0]?.Row || [];

            // Przeszukiwanie wierszy pod kątem przekazanego workStation
            const exists = rows.some(row => row.workStation === workStation);

            // Zwrócenie wyniku jako boolean
            return exists;
        } catch (jsonParseError) {
            console.error('Failed to parse JSON:', jsonParseError);
            console.error('Response text:', textData);
            return false; // Jeżeli wystąpił błąd, zwracamy false
        }
    } catch (error) {
        console.error('Failed to fetch data:', error);
        return false; // Jeżeli wystąpił błąd, zwracamy false
    }
}


function clearForm() {
    const form = document.getElementById('productionForm');
    form.reset();

    // Ukrycie wszystkich sekcji formularza
    document.querySelectorAll('.form-section').forEach(section => {
        section.style.display = 'none';
    });

    // Usunięcie klas walidacyjnych
    document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    document.querySelectorAll('.is-valid').forEach(el => el.classList.remove('is-valid'));

    // Usunięcie komunikatów walidacyjnych
    const workStationError = document.getElementById('workStationError');
    if (workStationError) {
        workStationError.textContent = '';
        workStationError.classList.remove('success-message');
    }
}


async function checkIfWorkCenterExists(workCenter) {
    const url = `${checkIfWorkCenterExistsQuery}&Param.1=${encodeURIComponent(workCenter)}&Content-type=text/json`;

    try {
        const jsonData = await fetchData(url);

        // Sprawdzanie czy odpowiedź zawiera oczekiwane dane
        const result = jsonData?.Rowsets?.Rowset?.[0]?.Row?.[0]?.RESULT;

        // Zwrócenie wyniku jako boolean
        return result === 'TRUE';
    } catch (error) {
        console.error('Failed to fetch data:', error);
        return false; // Jeżeli wystąpił błąd, zwracamy false
    }
}


function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section.style.display === 'none') {
        section.style.display = 'block';
    } else {
        section.style.display = 'none';
    }
}


function sendDataToMDO(paramValues, link) {
    let queryParams = '';
    let index = 1;

    for (const key in paramValues) {
        if (paramValues.hasOwnProperty(key)) {
            queryParams += `&AttributeName.${index}=${encodeURIComponent(key)}&AttributeValue.${index}=${encodeURIComponent(paramValues[key])}`;
            index++;
        }
    }

    const fullLink = link + queryParams;

    fetch(fullLink, {
        method: 'GET',
        mode: 'no-cors'
    }).then(response => {
        showConfirmation('Formularz został pomyślnie wysłany.');
        clearForm();
    }).catch(error => {
        console.error('Wystąpił błąd podczas wysyłania żądania:', error);
        showConfirmation('Wystąpił błąd podczas wysyłania żądania.');
    });
}


// ------------------------------------------------------------------------------- Skrypty do listy andonów -----------------------------------------------------------------------------------


async function initListPage() {
    fetchAndFillTable(1);
    const descriptionFilterInput = document.getElementById('descriptionFilter');
    const workStationFilterInput = document.getElementById('workStationFilter');

    descriptionFilterInput.addEventListener('input', filterTable);
    workStationFilterInput.addEventListener('input', filterTable);
    loadMenu();
}


function filterTable() {
    const descriptionFilter = document.getElementById('descriptionFilter').value.toUpperCase();
    const workStationFilter = document.getElementById('workStationFilter').value.toUpperCase();

    const filteredData = allData.filter(row => {
        const description = row.description.toUpperCase();
        const workStation = row.workStation.toUpperCase();

        return description.includes(descriptionFilter) && workStation.includes(workStationFilter);
    });

    // Wywołujemy funkcję do generowania tabeli na nowo na podstawie przefiltrowanych danych
    generateTable(filteredData, 1); // Generujemy tabelę dla pierwszej strony po filtracji
}


function fetchAndFillTable(page) {

    fetch(selectMDO)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            allData = data.Rowsets.Rowset[0].Row; // Przechowuje wszystkie dane

            // Wywołujemy funkcję do generowania tabeli na podstawie wszystkich danych
            generateTable(allData, page);
        })
        .catch(error => console.error('Error fetching data:', error));
}


function generateTable(data, page) {
    const tableBody = document.getElementById('andonTable').getElementsByTagName('tbody')[0];
    tableBody.innerHTML = ''; // Wyczyszczenie poprzednich danych

    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const rows = data.slice(startIndex, endIndex);

    rows.forEach(row => {
        const description = row.description;
        const workStation = row.workStation;

        // Tworzenie wiersza tabeli
        const newRow = document.createElement('tr');
        newRow.innerHTML = `
        <td>${description}</td>
        <td>${workStation}</td>
        <td>
            <a href="http://<hostname>:<port><path to your edit page>/edit.html?workStation=${workStation}" target="_blank" class="btn btn-sm edit-button">Edytuj</a> 
            <a href="http://<hostname>:<port><path to your andon page>/andon.html?workStation=${workStation}" target="_blank" class="btn btn-sm start-button">Uruchom</a>
        </td>
    `;  // powyze

        // Dodanie wiersza do tabeli
        tableBody.appendChild(newRow);
    });

    // Ponowne wywołanie funkcji do aktualizacji paginacji
    updatePagination(page, data.length);
}


function updatePagination(currentPage, totalCount) {
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = ''; // Wyczyszczenie poprzedniej paginacji

    const totalPages = Math.ceil(totalCount / pageSize);

    // Poprzednia strona
    const prevPageItem = document.createElement('li');
    prevPageItem.className = `page-item${currentPage === 1 ? ' disabled' : ''}`;
    const prevLink = document.createElement('a');
    prevLink.className = 'page-link';
    prevLink.href = '#';
    prevLink.innerText = 'Poprzednia';
    prevLink.onclick = () => {
        if (currentPage > 1) {
            generateTable(allData, currentPage - 1);
        }
    };
    prevPageItem.appendChild(prevLink);
    pagination.appendChild(prevPageItem);

    // Numery stron
    for (let i = 1; i <= totalPages; i++) {
        const li = document.createElement('li');
        li.className = `page-item${i === currentPage ? ' active' : ''}`;
        const a = document.createElement('a');
        a.className = 'page-link';
        a.href = '#';
        a.innerText = i;
        a.onclick = () => {
            generateTable(allData, i);
        };
        li.appendChild(a);
        pagination.appendChild(li);
    }

    // Następna strona
    const nextPageItem = document.createElement('li');
    nextPageItem.className = `page-item${currentPage === totalPages ? ' disabled' : ''}`;
    const nextLink = document.createElement('a');
    nextLink.className = 'page-link';
    nextLink.href = '#';
    nextLink.innerText = 'Następna';
    nextLink.onclick = () => {
        if (currentPage < totalPages) {
            generateTable(allData, currentPage + 1);
        }
    };
    nextPageItem.appendChild(nextLink);
    pagination.appendChild(nextPageItem);
}


// ------------------------------------------------------------------------------- Skrypty do Andona ----------------------------------------------------------------------------------------------------


async function andonInit() {
    const workStation = getValueFromUrl('workStation');
    debugger;
    const shiftData = await checkShift(workStation);
    if (shiftData) {
        updateCurrentDateTime();
        setInterval(updateCurrentDateTime, 1000);
        setDescription();
    } 
}


function updateCurrentDateTime() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    const formattedDate = `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
    document.getElementById('actuallDate').textContent = formattedDate;
}


function timeToMinutes(time) {
    if (time === "NA") return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}


function calculateMinutesBetween(start, end) {
    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);

    if (endMinutes >= startMinutes) {
        return endMinutes - startMinutes;
    } else {
        // Jeśli koniec jest wcześniejszy niż początek, oznacza to że zmiana przekracza północ
        return (1440 - startMinutes) + endMinutes;
    }
}


function calculateShiftDuration(start, end, breaks) {
    const shiftDuration = calculateMinutesBetween(start, end);
    let breakDuration = 0;

    breaks.forEach(b => {
        if (b.start !== "NA" && b.end !== "NA") {
            breakDuration += calculateMinutesBetween(b.start, b.end);
        }
    });

    return shiftDuration - breakDuration;
}


function isCurrentTimeInShift(start, end, id) {
    const now = new Date();    //zmieniamy do testów innych zmian
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);

    if (id == 1 || id == 2) {
        return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else if (id == 3) {
        if (startMinutes > endMinutes) {
            // Zmiana przekracza północ
            return (currentMinutes >= startMinutes && currentMinutes <= 1439) || (currentMinutes >= 0 && currentMinutes <= endMinutes);
        } else {
            // Zwykła zmiana w obrębie jednego dnia
            return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
        }
    } else {
        return false; 
    }
}


async function setDescription() {
    workStation = getValueFromUrl('workStation');
    const data = await fetchDataFromServer(workStation);
    if (!data) {
        console.log('Błąd pobierania danych lub brak danych.');
        return false;
    }

    document.getElementById('description').innerText = data.description; 
    
}


async function fetchDataFromServer(workStation) {

    try {
        const response = await fetch(selectMDO);
        const data = await response.json();
        const rowsets = data.Rowsets;
        if (rowsets && rowsets.Rowset && rowsets.Rowset.length > 0 && rowsets.Rowset[0].Row) {
            const rows = rowsets.Rowset[0].Row;
            const foundRow = rows.find(row => row.workStation === workStation);
            return foundRow ? foundRow : null;
        } else {
            console.log("Brak danych w odpowiedzi");
            return null;
        }
    } catch (error) {
        console.error('Błąd pobierania danych:', error);
        return null;
    }
}


async function checkShift(workStation) {
    const data = await fetchDataFromServer(workStation);
    if (!data) {
        showConfirmation('Błąd pobierania danych lub brak danych.');
        return false;
    }

    const now = new Date();  //zmieniamy do testów innych zmian
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const shifts = createShifts(data);

    const currentShift = findCurrentShift(shifts);
    let producedUnits = 0;
    
    if (currentShift) {
        if (!isCurrentTimeInBreak(currentMinutes, currentShift.breaks)) {
            const elapsedMinutes = calculateElapsedMinutes(currentShift.start,currentShift.end, currentShift.breaks, currentMinutes);
            producedUnits = calculateProducedUnits(elapsedMinutes, currentShift);
            document.getElementById('content').innerText = `ZMIANA ${currentShift.id}`;
        } else {
            document.getElementById('content').innerText = "PRZERWA";
            producedUnits = getLastKnownProducedUnits();
        }

        await updateUI(producedUnits, currentShift);
        saveLastKnownProducedUnits(producedUnits);

        return { currentShift, producedUnits };
    } else {
        showConfirmation('Nie ma zmiany dla aktualnej godziny.');
        return false;
    }
}


function createShifts(data) {
    return [
        {
            id: 1,
            start: data.firstShiftStart,
            end: data.firstShiftEnd,
            quantity: data.firstShiftQuantity,
            breaks: [
                { start: data.firstShiftBreak1Start, end: data.firstShiftBreak1End },
                { start: data.firstShiftBreak2Start, end: data.firstShiftBreak2End },
                { start: data.firstShiftBreak3Start, end: data.firstShiftBreak3End }
            ]
        },
        {
            id: 2,
            start: data.secondShiftStart,
            end: data.secondShiftEnd,
            quantity: data.secondShiftQuantity,
            breaks: [
                { start: data.secondShiftBreak1Start, end: data.secondShiftBreak1End },
                { start: data.secondShiftBreak2Start, end: data.secondShiftBreak2End },
                { start: data.secondShiftBreak3Start, end: data.secondShiftBreak3End }
            ]
        },
        {
            id: 3,
            start: data.thirdShiftStart,
            end: data.thirdShiftEnd,
            quantity: data.thirdShiftQuantity,
            breaks: [
                { start: data.thirdShiftBreak1Start, end: data.thirdShiftBreak1End },
                { start: data.thirdShiftBreak2Start, end: data.thirdShiftBreak2End },
                { start: data.thirdShiftBreak3Start, end: data.thirdShiftBreak3End }
            ]
        }
    ];
}


function findCurrentShift(shifts) {
    for (const shift of shifts) {
        if (isCurrentTimeInShift(shift.start, shift.end, shift.id)) {
            if (currentShiftId !== shift.id) {
                if (shift.id === 1 || shift.id === 2) {
                    setDatesForQuery(shift.start, shift.end);
                } else {
                    setDatesForThirdShift(shift.start, shift.end);
                }
                currentShiftId = shift.id;
            }
            return shift;
        }
    }
    return null;
}


function calculateElapsedMinutes(shiftStart, shiftEnd, breaks, currentMinutes) {
    const shiftStartMinutes = timeToMinutes(shiftStart);
    const shiftEndMinutes = timeToMinutes(shiftEnd);
    let elapsedMinutes = 0;

    // Sprawdzenie, czy zmiana przekracza północ
    if (shiftEndMinutes < shiftStartMinutes) {
        if (currentMinutes < shiftStartMinutes) {
            // Przed północą
            elapsedMinutes = currentMinutes + (1440 - shiftStartMinutes);
        } else {
            // Po północy
            elapsedMinutes = currentMinutes - shiftStartMinutes;
        }
    } else {
        elapsedMinutes = currentMinutes - shiftStartMinutes;
    }

    // Iteracja po przerwach i odejmowanie ich czasu od elapsedMinutes
    for (const breakTime of breaks) {
        if (breakTime.start !== "NA" && breakTime.end !== "NA") {
            const breakStartMinutes = timeToMinutes(breakTime.start);
            const breakEndMinutes = timeToMinutes(breakTime.end);

            if (breakEndMinutes < breakStartMinutes) {
                // Przerwa przekracza północ
                if (currentMinutes >= breakStartMinutes || currentMinutes < breakEndMinutes) {
                    // Przerwa jest aktywna
                    if (currentMinutes >= breakStartMinutes) {
                        const breakDuration = 1440 - breakStartMinutes;
                        elapsedMinutes -= breakDuration;
                    } else {
                        const breakDuration = breakEndMinutes;
                        elapsedMinutes -= breakDuration;
                    }
                }
            } else {
                // Przerwa nie przekracza północy
                if (currentMinutes <= breakEndMinutes && currentMinutes > breakEndMinutes + (shiftEndMinutes < shiftStartMinutes ? 1440 : 0)) {
                    // Przerwa miała już miejsce
                    const breakDuration = breakEndMinutes - breakStartMinutes;
                    elapsedMinutes -= breakDuration;
                }
            }
        }
    }

    return elapsedMinutes;
}

function calculateProducedUnits(elapsedMinutes, shift) {
    const totalShiftMinutes = calculateShiftDuration(shift.start, shift.end, shift.breaks);
    const quantity = parseInt(shift.quantity) || 0;
    const timePerUnit = totalShiftMinutes / quantity;
    return Math.floor(elapsedMinutes / timePerUnit);
}


async function updateUI(producedUnits, currentShift) {
    const qty = await fetchWcQtyFromServer();

    if (qty) {
        if (qty === "NA") {
            updateBackgroundColor(-2, producedUnits);
            document.getElementById('actual').innerText = 0;
        } else {
            updateBackgroundColor(qty, producedUnits);
            document.getElementById('actual').innerText = qty;
        }
    } else {
        console.log("Błąd połączenia z bazą!");
        document.getElementById('actual').innerText = 0;
    }

    document.getElementById('target').innerText = currentShift.quantity;
    document.getElementById('plan').innerText = producedUnits;
}


function saveLastKnownProducedUnits(producedUnits) {
    // Konwertujemy producedUnits na string (localStorage lub sessionStorage przechowują dane jako tekst)
    const serializedProducedUnits = JSON.stringify(producedUnits);
    
    // Zapisujemy wartość do localStorage lub sessionStorage pod kluczem 'lastProducedUnits'
    localStorage.setItem('lastProducedUnits', serializedProducedUnits);
}


function getLastKnownProducedUnits() {
    // Pobieramy zapisaną wartość z localStorage lub sessionStorage
    const serializedProducedUnits = localStorage.getItem('lastProducedUnits');
    
    // Jeśli wartość istnieje, deserializujemy ją (parsujemy z powrotem do obiektu)
    if (serializedProducedUnits !== null) {
        return JSON.parse(serializedProducedUnits);
    }
    
    // Domyślnie zwracamy 0 lub inny wartość, jeśli nic nie zostało jeszcze zapisane
    return 0;
}


function setDatesForThirdShift(startTime, endTime){
    const startDate = createTimeObject(startTime);
    startDate.setHours(startDate.getHours() + checkDiffFromLocalToUtc());
    const endDate = createTimeObject(endTime);
    endDate.setHours(endDate.getHours() + checkDiffFromLocalToUtc());
    endDate.setDate(endDate.getDate() +1);
    startDateForQuery = formatISODateToCustomFormat(startDate); 
    endDateForQuery = formatISODateToCustomFormat(endDate);
}

function createTimeObject(timeString) {
    const [hours, minutes] = timeString.split(':').map(num => parseInt(num, 10));

    // Tworzymy obiekt daty z aktualną datą, ale godzinę i minutę ustawiamy z timeString
    const date = new Date();
    date.setHours(hours);
    date.setMinutes(minutes);

    return date;
}


function checkDiffFromLocalToUtc() {
    var now = new Date();
    return now.getTimezoneOffset() / 60;
}


function setDatesForQuery(startTime, endTime) {
    const startDate = createTimeObject(startTime);
    startDate.setHours(startDate.getHours() + checkDiffFromLocalToUtc());
    const endDate = createTimeObject(endTime);
    endDate.setHours(endDate.getHours() + checkDiffFromLocalToUtc());
    
    startDateForQuery = formatISODateToCustomFormat(startDate); 
    endDateForQuery = formatISODateToCustomFormat(endDate);
}


function formatISODateToCustomFormat(dateToChange) {
    const date = new Date(dateToChange);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}`;
    return `'${formattedDate}'`;
}


async function fetchWcQtyFromServer() {
    const param1 = getValueFromUrl('workStation');
    const param2 = startDateForQuery;
    const param3 = endDateForQuery;
    
    const url = `${producedUnitsByWc}&Param.1=${param1}&Param.2=${encodeURIComponent(param2)}&Param.3=${encodeURIComponent(param3)}&Content-type=text/json`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data && data.Rowsets && data.Rowsets.Rowset && data.Rowsets.Rowset.length > 0 && data.Rowsets.Rowset[0].Row) {
            const row = data.Rowsets.Rowset[0].Row[0];
            const totalQuantity = row.TOTALQUANTITY || null; // Pobranie totalQuantity z odpowiedzi
            return totalQuantity;
        } else {
            console.log("Brak danych w odpowiedzi");
            return null;
        }
    } catch (error) {
        console.error('Błąd pobierania danych:', error);
        return null;
    }
}

function updateBackgroundColor(produced, plan) {
    const actualDiv = document.getElementById('actual');

    if (produced <= plan - 2) {
        actualDiv.style.backgroundColor = '#b30000';
    } else if (produced >= plan - 1) {
        actualDiv.style.backgroundColor = 'green';
    }
}


function isCurrentTimeInBreak(currentMinutes, breaks) {
    for (const b of breaks) {
        const breakStartMinutes = timeToMinutes(b.start);
        const breakEndMinutes = timeToMinutes(b.end);

        if (currentMinutes >= breakStartMinutes && currentMinutes <= breakEndMinutes) {
            return true;
        }
    }
    return false;
}


// ------------------------------------------------------------------------------- Funkcjie pomocnicze ----------------------------------------------------------------------------------------------------


function showConfirmation(message) {
    const confirmationMessage = document.getElementById("confirmationMessage");
    const confirmationBox = document.getElementById("confirmationBox");
    const overlay = document.getElementById("overlay");

    if (confirmationMessage && confirmationBox && overlay) {
        confirmationMessage.innerHTML = message;
        confirmationBox.style.display = "block";
        overlay.style.display = "block";
        document.body.classList.add("blur-background");
    } else {
        console.error("Elementy HTML nie zostały znalezione.");
    }
}

function closeConfirmation() {
    document.getElementById("confirmationBox").style.display = "none";
    document.getElementById("overlay").style.display = "none";
    document.body.classList.remove("blur-background");
}

// Menu functions

function openNav() {
    document.getElementById("mySidebar").style.width = "250px";
}


function closeNav() {
    document.getElementById("mySidebar").style.width = "0";
}


function loadMenu() {

    fetch('../partials/menu.html')
        .then(response => response.text())
        .then(data => {
            document.getElementById('menu-items').innerHTML = data;
        });

}