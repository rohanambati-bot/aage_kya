import express from 'express'
import { QUIZ_QUESTIONS } from '../data/quizQuestions.js'

const router = express.Router()

router.get('/api/quiz/questions', (req, res) => {
  res.json({ success: true, questions: QUIZ_QUESTIONS })
})


export default router
