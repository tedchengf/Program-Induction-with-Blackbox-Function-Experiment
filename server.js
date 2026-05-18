const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/api/prolific', (req, res) => {
  const { PROLIFIC_PID, STUDY_ID, SESSION_ID } = req.query;
  res.json({ participantId: PROLIFIC_PID, studyId: STUDY_ID, sessionId: SESSION_ID });
});

app.post('/api/data', (req, res) => {
  console.log('Trial data:', JSON.stringify(req.body));
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Experiment server running at http://localhost:${PORT}`);
});
