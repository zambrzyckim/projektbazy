// server.js - rozbudowana wersja
const express = require('express');
const oracledb = require('oracledb');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const dbConfig = {
    user: "MATEUSZ_Z03_SCHEMA_58G6M",
    password: "IJLW57#UQL4R2sQU8XGOMVEBD8241O",
    connectString: "tcps://db.freesql.com:2484/23ai_34ui2"
};

// Mapowanie modeli na URL-e zdjęć
const MODEL_IMAGES = {
    'ev2': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ___IkrgxCavX0PTGGD-q4OtTrdrgZ_ccIGA&s',
    'ev6': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSfeeeyvRcoHKgPbqH5Hjkgy-o96m0pfB3I5Q&s',
    'k4': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSh2qfk_rjmstBQUv729_YPbSZObHunPlIrRg&s',
    'niro': 'https://kia.cardroom.pl/wp-content/uploads/2025/01/kia-niro-ev-my23-actionpanel-get-yours.jpg',
    'sportage': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRxeCaciiPko2c3Z-8bFR-V9bjcQPLTbx5Fww&s'
};

const DEFAULT_CAR_IMAGE = 'https://placehold.co/600x400?text=KIA';

function getImageForModel(modelName) {
    if (!modelName) return DEFAULT_CAR_IMAGE;
    const key = modelName.toLowerCase().trim();
    return MODEL_IMAGES[key] || DEFAULT_CAR_IMAGE;
}

async function initializePool() {
    try { await oracledb.createPool(dbConfig); console.log('Połączono z bazą Oracle.'); }
    catch (err) { console.error('Błąd bazy:', err); }
}
initializePool();

// ---- LOGOWANIE ----
app.post('/api/login', async (req, res) => {
    const { login, password } = req.body;
    let conn;
    try {
        conn = await oracledb.getConnection();
        const result = await conn.execute(
            `SELECT u.ROLA, r.NAZWA as ROLA_NAZWA, d.NAZWA as DEALER_NAZWA
             FROM UZYTKOWNICY u
             LEFT JOIN ROLE r ON u.ROLA_ID = r.ID
             LEFT JOIN DEALERZY d ON u.DEALER_ID = d.ID
             WHERE u.LOGIN = :login AND u.HASLO = :password`,
            [login, password],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (result.rows.length > 0) {
            const row = result.rows[0];
            const rawRole = row.ROLA_NAZWA || row.ROLA || '';
            const lowerRole = rawRole.toString().toLowerCase();
            const rola = lowerRole.includes('dystrybutor') ? 'distributor'
                : lowerRole.includes('dealer') ? 'dealer'
                : lowerRole;
            res.json({
                status: 'ZALOGOWANO PRAWIDLOWO',
                rola,
                dealer: row.DEALER_NAZWA
            });
        } else {
            res.status(401).json({ status: 'Blad' });
        }
    } catch (err) { res.status(500).send(err.message); }
    finally { if (conn) await conn.close(); }
});

// ---- SŁOWNIKI ----
app.get('/api/modele', async (req, res) => {
    let conn;
    try {
        conn = await oracledb.getConnection();
        const result = await conn.execute(
            `SELECT * FROM MODELE ORDER BY NAZWA`,
            [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (err) { res.status(500).send(err.message); }
    finally { if (conn) await conn.close(); }
});

app.get('/api/kolory', async (req, res) => {
    let conn;
    try {
        conn = await oracledb.getConnection();
        const result = await conn.execute(
            `SELECT * FROM KOLORY ORDER BY NAZWA`,
            [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (err) { res.status(500).send(err.message); }
    finally { if (conn) await conn.close(); }
});

app.get('/api/statusy', async (req, res) => {
    let conn;
    try {
        conn = await oracledb.getConnection();
        const result = await conn.execute(
            `SELECT * FROM STATUSY_ZAMOWIEN ORDER BY ID`,
            [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (err) { res.status(500).send(err.message); }
    finally { if (conn) await conn.close(); }
});

app.get('/api/dealerzy', async (req, res) => {
    let conn;
    try {
        conn = await oracledb.getConnection();
        const result = await conn.execute(
            `SELECT * FROM DEALERZY ORDER BY NAZWA`,
            [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (err) { res.status(500).send(err.message); }
    finally { if (conn) await conn.close(); }
});

app.get('/api/roles', async (req, res) => {
    let conn;
    try {
        conn = await oracledb.getConnection();
        const result = await conn.execute(
            `SELECT ID, NAZWA FROM ROLE ORDER BY ID`,
            [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (err) { res.status(500).send(err.message); }
    finally { if (conn) await conn.close(); }
});

app.post('/api/admin/users', async (req, res) => {
    const { login, password, role, dealer_id } = req.body;
    if (!login || !password || !role) {
        return res.status(400).json({ error: 'Wymagane pola: login, hasło, rola.' });
    }
    let conn;
    try {
        conn = await oracledb.getConnection();
        const roleResult = await conn.execute(
            `SELECT ID, NAZWA FROM ROLE WHERE LOWER(NAZWA) = :role`,
            [role.toString().toLowerCase()],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (roleResult.rows.length === 0) {
            return res.status(400).json({ error: 'Nieznana rola.' });
        }
        const roleId = roleResult.rows[0].ID;
        const roleName = roleResult.rows[0].NAZWA;
        const dealerId = role.toString().toLowerCase() === 'dealer' ? dealer_id || null : null;
        if (role.toString().toLowerCase() === 'dealer' && !dealerId) {
            return res.status(400).json({ error: 'Dealer jest wymagany dla roli dealer.' });
        }

        await conn.execute(
            `INSERT INTO UZYTKOWNICY (LOGIN, HASLO, ROLA, ROLA_ID, DEALER_ID)
             VALUES (:login, :password, :roleName, :roleId, :dealerId)`,
            { login, password, roleName, roleId, dealerId },
            { autoCommit: true }
        );

        res.json({ success: true });
    } catch (err) {
        if (conn) {
            try { await conn.rollback(); } catch (_) {}
        }
        res.status(500).json({ error: err.message });
    } finally { if (conn) await conn.close(); }
});

app.get('/api/admin/users', async (req, res) => {
    let conn;
    try {
        conn = await oracledb.getConnection();
        const result = await conn.execute(
            `SELECT u.ID, u.LOGIN, u.ROLA, d.NAZWA AS DEALER_NAZWA
             FROM UZYTKOWNICY u
             LEFT JOIN DEALERZY d ON u.DEALER_ID = d.ID
             ORDER BY u.ID`,
            [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (err) { res.status(500).send(err.message); }
    finally { if (conn) await conn.close(); }
});

app.patch('/api/admin/users/:id', async (req, res) => {
    const { password } = req.body;
    const { id } = req.params;
    if (!password) {
        return res.status(400).json({ error: 'Nowe hasło jest wymagane.' });
    }
    let conn;
    try {
        conn = await oracledb.getConnection();
        await conn.execute(
            `UPDATE UZYTKOWNICY SET HASLO = :password WHERE ID = :id`,
            { password, id },
            { autoCommit: true }
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
    finally { if (conn) await conn.close(); }
});

app.delete('/api/admin/users/:id', async (req, res) => {
    const { id } = req.params;
    let conn;
    try {
        conn = await oracledb.getConnection();
        await conn.execute(
            `DELETE FROM UZYTKOWNICY WHERE ID = :id`,
            [id],
            { autoCommit: true }
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
    finally { if (conn) await conn.close(); }
});

// ---- SAMOCHODY ----
app.get('/api/samochody', async (req, res) => {
    let conn;
    try {
        conn = await oracledb.getConnection();
        const result = await conn.execute(
            `SELECT s.ID, s.NAZWA, s.CENA, s.SZTUK, s.FOTO,
                    m.NAZWA as MODEL_NAZWA, m.SEGMENT,
                    k.NAZWA as KOLOR_NAZWA, k.KOD_HEX
             FROM SAMOCHODY s
             LEFT JOIN MODELE m ON s.MODEL_ID = m.ID
             LEFT JOIN KOLORY k ON s.KOLOR_ID = k.ID
             ORDER BY s.ID ASC`,
            [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (err) { res.status(500).send(err.message); }
    finally { if (conn) await conn.close(); }
});

app.post('/api/samochody', async (req, res) => {
    const { name, price, stock, model_id, kolor_id } = req.body;
    const foto = getImageForModel(name);
    let conn;
    try {
        conn = await oracledb.getConnection();
        await conn.execute(
            `INSERT INTO SAMOCHODY (NAZWA, CENA, SZTUK, FOTO, MODEL_ID, KOLOR_ID)
             VALUES (:n, :p, :s, :f, :m, :k)`,
            [name, price, stock, foto, model_id || null, kolor_id || null],
            { autoCommit: true }
        );
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
    finally { if (conn) await conn.close(); }
});

app.delete('/api/samochody/:id', async (req, res) => {
    const { id } = req.params;
    let conn;
    try {
        conn = await oracledb.getConnection();
        await conn.execute(`DELETE FROM SAMOCHODY WHERE ID = :id`, [id], { autoCommit: true });
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
    finally { if (conn) await conn.close(); }
});

app.patch('/api/samochody/:id', async (req, res) => {
    const { id } = req.params;
    const { zmiana } = req.body;
    let conn;
    try {
        conn = await oracledb.getConnection();
        const check = await conn.execute(
            `SELECT SZTUK FROM SAMOCHODY WHERE ID = :id`,
            [id], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (check.rows.length === 0) return res.status(404).json({ error: 'Nie znaleziono auta.' });
        const nowe = check.rows[0].SZTUK + parseInt(zmiana);
        if (nowe < 0) return res.status(400).json({ error: 'Brak wystarczającej liczby sztuk.' });
        await conn.execute(
            `UPDATE SAMOCHODY SET SZTUK = :nowe WHERE ID = :id`,
            [nowe, id], { autoCommit: true }
        );
        res.json({ success: true, sztuk: nowe });
    } catch (err) { res.status(500).send(err.message); }
    finally { if (conn) await conn.close(); }
});

// ---- ZAMÓWIENIA ----
app.get('/api/zamowienia', async (req, res) => {
    const { dealer } = req.query;
    let conn;
    try {
        conn = await oracledb.getConnection();
        let sql, params;
        if (dealer) {
            sql = `SELECT z.ID, z.DEALER, z.DATA_ZAM, z.ILOSC, z.STATUS, s.NAZWA,
                          sz.NAZWA as STATUS_NAZWA
                   FROM ZAMOWIENIA z
                   JOIN SAMOCHODY s ON z.SAMOCHOD_ID = s.ID
                   LEFT JOIN STATUSY_ZAMOWIEN sz ON z.STATUS_ID = sz.ID
                   WHERE z.DEALER = :dealer ORDER BY z.DATA_ZAM DESC`;
            params = [dealer];
        } else {
            sql = `SELECT z.ID, z.DEALER, z.DATA_ZAM, z.ILOSC, z.STATUS, s.NAZWA,
                          sz.NAZWA as STATUS_NAZWA
                   FROM ZAMOWIENIA z
                   JOIN SAMOCHODY s ON z.SAMOCHOD_ID = s.ID
                   LEFT JOIN STATUSY_ZAMOWIEN sz ON z.STATUS_ID = sz.ID
                   ORDER BY z.DATA_ZAM DESC`;
            params = [];
        }
        const result = await conn.execute(sql, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        res.json(result.rows);
    } catch (err) { res.status(500).send(err.message); }
    finally { if (conn) await conn.close(); }
});

// ENDPOINT, 1 PROCEDURA DO SKŁADANIA ZAMÓWIEŃ ZLOZ_ZAMOWIENIE(samochod_id, dealer, ilosc, OUT error_msg) - ZAMÓWIENIA SKŁADANE PRZEZ DEALERÓW
app.post('/api/zamowienia', async (req, res) => {
    const { samochod_id, ilosc, dealer } = req.body;
    let conn;
    try {
        conn = await oracledb.getConnection();
        await conn.execute(
            `BEGIN ZLOZ_ZAMOWIENIE(:sid, :dealer, :ilosc, NULL); END;`,
            { sid: samochod_id, dealer: dealer, ilosc: ilosc },
            { autoCommit: false }
        );
        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        if (conn) await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally { if (conn) await conn.close(); }
});

// Zmiana statusu zamówienia (dystrybutor) przez PROCEDURĘ Oracle
app.patch('/api/zamowienia/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    let conn;
    try {
        conn = await oracledb.getConnection();
        await conn.execute(
            `BEGIN ZMIEN_STATUS_ZAMOWIENIA(:id, :status); END;`,
            { id: id, status: status },
            { autoCommit: true }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally { if (conn) await conn.close(); }
});

app.delete('/api/zamowienia/:id', async (req, res) => {
    const { id } = req.params;
    let conn;
    try {
        conn = await oracledb.getConnection();
        await conn.execute(
            `DELETE FROM ZAMOWIENIA WHERE ID = :id`,
            [id],
            { autoCommit: true }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally { if (conn) await conn.close(); }
});
//
/*  
WYWOŁANIE PROCEDURY W FREESQL
BEGIN
    ZLOZ_ZAMOWIENIE(
        1,
        'KIA Kraków Nowa Huta',
        2,
        NULL
    );
END;
/
*/

// Wartość stoku (FUNKCJA Oracle)
app.get('/api/stats/wartosc-stoku', async (req, res) => {
    let conn;
    try {
        conn = await oracledb.getConnection();
        const result = await conn.execute(
            `SELECT WARTOSC_STOKU() as WARTOSC FROM DUAL`,
            [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json({ wartosc: result.rows[0].WARTOSC });
    } catch (err) { res.status(500).send(err.message); }
    finally { if (conn) await conn.close(); }
});

app.listen(3000, () => console.log('Serwer działa na http://localhost:3000'));

/*

FUNKCJE:

WARTOSC_STOKU
LICZBA_ZAMOWIEN_DEALERA

PROCEDURY:

ZLOZ_ZAMOWIENIE
ZMIEN_STATUS_ZAMOWIENIA

TRIGGERY

TRG_SAMOCHODY_MIN_SZTUK
TRG_ZAMOWIENIA_DATA

*/