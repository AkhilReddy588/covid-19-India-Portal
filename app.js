const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()
app.use(express.json())

let db
const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')

//JWT authentiatiion
const authenticateToken = (request, response, next) => {
  const authHeaders = request.headers['authorization']
  if (authHeaders !== undefined) {
    const jwtToken = authHeaders.split(' ')[1]
    jwt.verify(jwtToken, 'secretkey', (error, payload) => {
      if (error) {
        response.status(401).send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  } else {
    response.status(401).send('Invalid JWT Token')
  }
}

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })

    app.listen(3000, () => {
      console.log('Server is listening on port 3000')
    })
  } catch (e) {
    console.log(`DB ERROR ${e}`)
  }
}

initializeDBAndServer()

//Login API
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `
      SELECT 
        *
      FROM
      user
      WHERE 
        username = '${username}';  
    `
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    //Invalid username
    response.status(400).send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'secretkey')
      response.send({jwtToken})
    } else {
      response.status(400).send('Invalid password')
    }
  }
})

//Get states API
app.get('/states/', authenticateToken, async (request, response) => {
  const getQuery = `
    SELECT
      state_id as stateId, state_name as stateName, population
    FROM
    state;  
  `
  const statesList = await db.all(getQuery)
  response.send(statesList)
})

//Get state API
app.get('/states/:stateId', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const getQuery = `
    SELECT
      state_id as stateId, state_name as stateName, population
    FROM
    state
    WHERE
      state_id = ${stateId};  
  `
  const state = await db.get(getQuery)
  response.send(state)
})

// create district API
app.post('/districts/', authenticateToken, async (request, respone) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const postQuery = `
    INSERT INTO
    district (district_name, state_id, cases, cured, active, deaths)
    VALUES('${districtName}', ${stateId}, ${cases},${cured}, ${active}, ${deaths});
  `

  await db.run(postQuery)
  respone.send('District Successfully Added')
})

app.get(
  '/districts/:districtId',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getQuery = `
    SELECT 
      district_id as districtId,
      district_name as districtName,
      state_id as stateId,
      cases, cured, active, deaths
    FROM
      district
    WHERE
      district_id = ${districtId};    
  `
    const district = await db.get(getQuery)
    response.send(district)
  },
)

app.delete(
  '/districts/:districtId',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteQuery = `
    DELETE
    FROM district
    WHERE
      district_id = ${districtId};
  `
    await db.run(deleteQuery)
    response.send('District Removed')
  },
)

app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const districtDetails = request.body
    const {districtName, stateId, cases, cured, active, deaths} =
      districtDetails
    const putQuery = `
    UPDATE
      district
    SET
      district_name = '${districtName}',
      state_id = ${stateId},
      cases = ${cases},
      cured = ${cured},
      active = ${active},
      deaths = ${deaths}
    WHERE
      district_id = ${districtId};    
  `
    await db.run(putQuery)
    response.send('District Details Updated')
  },
)

app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const getQuery = `
    SELECT
     sum(cases) as totalCases,
     sum(cured) as totalCured,
     sum(active) as totalActive, 
     sum(deaths) as totalDeaths
    FROM
    district
    WHERE
    state_id = ${stateId};
  `
    const result = await db.get(getQuery)
    response.send(result)
  },
)

module.exports = app
