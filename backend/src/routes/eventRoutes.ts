import { Router, Request, Response, NextFunction } from "express";
import { getSecurityEvents, SecurityEventFilter } from "../db/repositories/securityEventsRepository";
import { explainDecision, formatExplanationAsText } from "../services/explainability";

const router = Router();

/**
 * GET /api/events
 *
 * Query security audit events ordered newest first.
 * Supports filtering by eventType, requestId, toolName, limit, and date range.
 *
 * Query params:
 * - limit: number (default 50)
 * - eventType: 'ALLOW' | 'CONFIRM' | 'BLOCK' | 'APPROVED' | 'DENIED'
 * - requestId: string
 * - toolName: string
 * - startDate / from / since: ISO date string
 * - endDate / to / until: ISO date string
 */
router.get("/", (req: Request, res: Response, next: NextFunction): void => {
  try {
    const {
      limit,
      eventType,
      requestId,
      toolName,
      startDate,
      from,
      since,
      endDate,
      to,
      until,
    } = req.query;

    const parsedLimit = limit ? parseInt(limit as string, 10) : 50;

    const filters: SecurityEventFilter = {
      limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 50,
      eventType: typeof eventType === "string" ? eventType : undefined,
      requestId: typeof requestId === "string" ? requestId : undefined,
      toolName: typeof toolName === "string" ? toolName : undefined,
      startDate: (startDate || from || since) as string | undefined,
      endDate: (endDate || to || until) as string | undefined,
    };

    const events = getSecurityEvents(filters);
    res.json(events);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/events/:requestId/explain
 *
 * Fetches the event(s) for the specified requestId, generates structured
 * explainability objects via explainDecision(), and returns them.
 */
router.get("/:requestId/explain", (req: Request, res: Response, next: NextFunction): void => {
  try {
    const { requestId } = req.params;
    const events = getSecurityEvents({ requestId });

    if (!events || events.length === 0) {
      res.status(404).json({ error: `No security events found for requestId '${requestId}'` });
      return;
    }

    // Chronological order (oldest first) so CONFIRM comes before APPROVED/DENIED
    const chronologicalEvents = [...events].reverse();
    const explanations = chronologicalEvents.map((evt) => explainDecision(evt));

    // Support text/plain format
    if (req.query.format === "text" || req.headers.accept === "text/plain") {
      const text = explanations.map(formatExplanationAsText).join("\n\n---\n\n");
      res.type("text/plain").send(text);
      return;
    }

    if (explanations.length === 1 && req.query.all !== "true") {
      res.json(explanations[0]);
    } else {
      res.json(explanations);
    }
  } catch (err) {
    next(err);
  }
});

export default router;
