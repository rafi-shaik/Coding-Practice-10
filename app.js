let express = require("express");
let path = require("path");

let sqlite3 = require("sqlite3");
let { open } = require("sqlite");
let bcrypt = require("bcrypt");
let jwt = require("jsonwebtoken");

let app = express();
app.use(express.json());
let db = null;

let dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`Db Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

// (Authenticating JSON web Token) Middleware function
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "My_secret_key", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

// API 1 user login
app.post("/login/", authenticateToken, async (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = ` SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(getUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const verifyPassword = await bcrypt.compare(password, dbUser.password);
    if (verifyPassword) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "My_secret_key");
      response.send({ jwtToken });
    } else if (verifyPassword === false) {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// API 2 GET list of states
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = ` 
    SELECT
     state_id as stateId,
     state_name as stateName,
     population
     FROM
        state
     ORDER BY 
        state_id;`;
  const statesArray = await db.all(getStatesQuery);
  response.send(statesArray);
});

//API 3 GET a state
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = ` 
    SELECT
       state_id as stateId,
       state_name as stateName,
       population
     FROM 
        state
     WHERE 
        state_id = ${stateId};`;
  const state = await db.get(getStateQuery);
  response.send(state);
});

//API 4 add new district
app.post("/districts/", authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const addDistrictQuery = ` 
    INSERT INTO 
        district (district_name, state_id, cases, cured, active, deaths)
     VALUES
        ('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});`;
  await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});

//API 5 GET a district
app.get(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = ` 
    SELECT 
        district_id as districtId,
        district_name as districtName,
        state_id as stateId,
        cases,
        cured,
        active,
        deaths
     FROM
        district
     WHERE 
        district_id = ${districtId};`;
    const district = await db.get(getDistrictQuery);
    response.send(district);
  }
);

// API 6 DELETE a district
app.delete(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = ` 
    DELETE FROM
        district
     WHERE 
        district_id = ${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

// API 7 Update details of a district
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const updateDistrictQuery = ` 
    UPDATE
        district
     SET 
        district_name = '${districtName}',
        state_id = ${stateId},
        cases = ${cases},
        cured = ${cured},
        active = ${active},
        deaths = ${deaths}
     WHERE district_id = ${districtId};`;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

// API 8 GET stats of a state
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatsQuery = ` 
    SELECT 
        SUM(cases) as totalCases,
        SUM(cured) as totalCured,
        SUM(active) as totalActive,
        SUM(deaths) as totalDeaths
     FROM
        district
     WHERE
        state_id = ${stateId};`;
    const stats = await db.get(getStatsQuery);
    response.send(stats);
  }
);

module.exports = app;
