import fs from 'fs';
import { countCsvRows } from '../../utils/csvAnalyzer.js';
import { CsvAnalysisJob } from './csvAnalysisJob.model.js';
import { addCsvAnalysisJob, getCsvAnalysisQueue } from '../../jobs/csvAnalysisQueue.js';

const SECONDS_PER_10_ROWS = 3;

export const uploadAndAnalyze = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const totalRows = await countCsvRows(req.file.path);
    const estimatedSeconds = Math.ceil((totalRows / 10) * SECONDS_PER_10_ROWS);

    const job = await CsvAnalysisJob.create({
      uploadedBy: req.user?.userId,
      fileName: req.file.originalname,
      status: 'pending',
      totalRows,
      estimatedSeconds,
    });

    await addCsvAnalysisJob({
      jobId: job._id.toString(),
      filePath: req.file.path,
      userId: req.user?.userId,
      fileName: req.file.originalname,
    });

    res.json({
      jobId: job._id.toString(),
      estimatedSeconds,
      totalRows,
    });
  } catch (error) {
    console.error('Analysis setup failed:', error);
    const filePath = req.file?.path;
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (deleteError) {
        console.error('Failed to delete uploaded file:', deleteError);
      }
    }
    next(error);
  }
};

export const getJobStatus = async (req, res, next) => {
  try {
    const job = await CsvAnalysisJob.findOne({
      _id: req.params.id,
      uploadedBy: req.user?.userId,
    })
      .select('status progress totalRows processedRows estimatedSeconds')
      .lean();

    if (!job) {
      return res.json({
        status: 'cancelled',
        progress: 0,
        totalRows: null,
        processedRows: null,
        estimatedSeconds: null,
      });
    }

    res.json({
      status: job.status,
      progress: job.progress,
      totalRows: job.totalRows,
      processedRows: job.processedRows,
      estimatedSeconds: job.estimatedSeconds,
    });
  } catch (error) {
    console.error('Failed to get job status:', error);
    next(error);
  }
};

export const getJob = async (req, res, next) => {
  try {
    const job = await CsvAnalysisJob.findOne({
      _id: req.params.id,
      uploadedBy: req.user?.userId,
    }).lean();

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
  } catch (error) {
    console.error('Failed to get job:', error);
    next(error);
  }
};

export const cancelJob = async (req, res, next) => {
  try {
    const job = await CsvAnalysisJob.findOne({
      _id: req.params.id,
      uploadedBy: req.user?.userId,
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return res.json({ message: 'Job already finished', status: job.status });
    }

    await CsvAnalysisJob.findByIdAndUpdate(req.params.id, {
      status: 'cancelled',
      completedAt: new Date(),
    });

    try {
      const queue = getCsvAnalysisQueue();
      const bullJob = await queue.getJob(job._id.toString());
      if (bullJob) {
        await bullJob.remove();
      }
    } catch (queueErr) {
      console.warn('Could not remove job from queue (may already be processing):', queueErr.message);
    }

    res.json({ message: 'Job cancelled', status: 'cancelled' });
  } catch (error) {
    console.error('Failed to cancel job:', error);
    next(error);
  }
};

export const listJobs = async (req, res, next) => {
  try {
    const jobs = await CsvAnalysisJob.find({
      uploadedBy: req.user?.userId,
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('_id fileName status progress totalRows createdAt completedAt')
      .lean();

    res.json({ jobs });
  } catch (error) {
    console.error('Failed to list jobs:', error);
    next(error);
  }
};
