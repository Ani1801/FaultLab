import { prisma } from '../../utils/prisma.js';
import type {
  RecordRequestLogDTO,
  ListRequestLogsQuery,
  PaginatedRequestLogsResponse,
  RequestLogResponse,
  AnalyticsResponse,
  VolumeOverTimeItem,
} from './requestLog.types.js';

export class RequestLogService {
  /**
   * Asynchronously records an incoming mock request log.
   * Designed to be non-blocking with safe error handling so that
   * logging failures never interrupt the mock runtime execution path.
   */
  async recordRequest(data: RecordRequestLogDTO): Promise<void> {
    try {
      await prisma.requestLog.create({
        data: {
          projectId: data.projectId,
          endpointId: data.endpointId || null,
          method: data.method.toUpperCase(),
          path: data.path,
          statusCode: data.statusCode,
          responseTime: data.responseTime,
          requestSize: data.requestSize ?? null,
          responseSize: data.responseSize ?? null,
          isFaultInjected: data.isFaultInjected ?? false,
          wasMatched: data.wasMatched ?? true,
        },
      });
    } catch (error) {
      // Log warning to server logs without throwing unhandled exceptions
      console.warn('[RequestLogService] Non-critical error recording request log:', error);
    }
  }

  /**
   * Retrieves a paginated and filtered list of request logs for a project.
   * Strictly enforces project ownership through workspace.
   */
  async listRequests(
    userId: string,
    projectId: string,
    query: ListRequestLogsQuery
  ): Promise<PaginatedRequestLogsResponse> {
    // 1. Verify project ownership through workspace (anti-IDOR)
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        workspace: {
          ownerId: userId,
        },
      },
    });

    if (!project) {
      const error = new Error('Project not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // 2. Build Prisma where clause
    const where: Record<string, any> = {
      projectId,
    };

    if (query.method) {
      where.method = query.method.toUpperCase();
    }

    if (query.statusCode !== undefined) {
      where.statusCode = query.statusCode;
    }

    if (query.endpointId) {
      where.endpointId = query.endpointId;
    }

    if (query.faultInjected !== undefined) {
      where.isFaultInjected = query.faultInjected;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    if (query.search) {
      where.path = {
        contains: query.search,
        mode: 'insensitive',
      };
    }

    // 3. Pagination calculation
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    // 4. Run count and findMany in parallel
    const [totalCount, logs] = await Promise.all([
      prisma.requestLog.count({ where }),
      prisma.requestLog.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
        include: {
          endpoint: {
            select: {
              id: true,
              name: true,
              method: true,
              path: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit) || 1;

    return {
      status: 'success',
      data: logs as unknown as RequestLogResponse[],
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Retrieves single request log details by ID.
   * Strictly enforces project ownership through workspace.
   */
  async getRequest(
    userId: string,
    projectId: string,
    requestId: string
  ): Promise<RequestLogResponse> {
    const log = await prisma.requestLog.findFirst({
      where: {
        id: requestId,
        projectId,
        project: {
          workspace: {
            ownerId: userId,
          },
        },
      },
      include: {
        endpoint: {
          select: {
            id: true,
            name: true,
            method: true,
            path: true,
          },
        },
      },
    });

    if (!log) {
      const error = new Error('Request log not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    return log as unknown as RequestLogResponse;
  }

  /**
   * Calculates aggregated performance metrics and request analytics for a project.
   * Uses efficient database-level aggregations and counts.
   */
  async getAnalytics(
    userId: string,
    projectId: string,
    timeRange: string = '24h'
  ): Promise<AnalyticsResponse> {
    // 1. Verify project ownership through workspace
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        workspace: {
          ownerId: userId,
        },
      },
    });

    if (!project) {
      const error = new Error('Project not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // 2. Compute date boundary
    const now = new Date();
    let durationMs = 24 * 60 * 60 * 1000; // default 24h
    let bucketCount = 12; // 2h intervals

    if (timeRange === '7d') {
      durationMs = 7 * 24 * 60 * 60 * 1000;
      bucketCount = 7; // daily intervals
    } else if (timeRange === '30d') {
      durationMs = 30 * 24 * 60 * 60 * 1000;
      bucketCount = 15; // 2-day intervals
    }

    const sinceDate = new Date(now.getTime() - durationMs);
    const where = {
      projectId,
      createdAt: {
        gte: sinceDate,
      },
    };

    // 3. Database aggregation queries
    const [
      totalRequests,
      successfulRequests,
      failedRequests,
      faultInjectedRequests,
      timeAgg,
      statusGroups,
      methodGroups,
      recentItems,
    ] = await Promise.all([
      prisma.requestLog.count({ where }),
      prisma.requestLog.count({
        where: {
          ...where,
          statusCode: { gte: 200, lte: 399 },
        },
      }),
      prisma.requestLog.count({
        where: {
          ...where,
          statusCode: { gte: 400, lte: 599 },
        },
      }),
      prisma.requestLog.count({
        where: {
          ...where,
          isFaultInjected: true,
        },
      }),
      prisma.requestLog.aggregate({
        where,
        _avg: { responseTime: true },
        _min: { responseTime: true },
        _max: { responseTime: true },
      }),
      prisma.requestLog.groupBy({
        by: ['statusCode'],
        where,
        _count: { _all: true },
        orderBy: {
          _count: { statusCode: 'desc' },
        },
      }),
      prisma.requestLog.groupBy({
        by: ['method'],
        where,
        _count: { _all: true },
        orderBy: {
          _count: { method: 'desc' },
        },
      }),
      prisma.requestLog.findMany({
        where,
        select: {
          createdAt: true,
          statusCode: true,
          isFaultInjected: true,
        },
      }),
    ]);

    // 4. Calculate metrics
    const successRate =
      totalRequests > 0
        ? Number(((successfulRequests / totalRequests) * 100).toFixed(1))
        : 100.0;

    const avgResponseTime = Math.round(timeAgg._avg.responseTime || 0);
    const minResponseTime = timeAgg._min.responseTime || 0;
    const maxResponseTime = timeAgg._max.responseTime || 0;

    const statusBreakdown = statusGroups.map((g) => ({
      statusCode: g.statusCode,
      count: g._count._all,
    }));

    const methodBreakdown = methodGroups.map((g) => ({
      method: g.method,
      count: g._count._all,
    }));

    // 5. Build time series volume buckets
    const bucketDuration = durationMs / bucketCount;
    const volumeBuckets: VolumeOverTimeItem[] = [];

    for (let i = 0; i < bucketCount; i++) {
      const bucketStart = new Date(sinceDate.getTime() + i * bucketDuration);
      const bucketEnd = new Date(bucketStart.getTime() + bucketDuration);

      const itemsInBucket = recentItems.filter((item) => {
        const t = item.createdAt.getTime();
        return t >= bucketStart.getTime() && t < bucketEnd.getTime();
      });

      const errors = itemsInBucket.filter((item) => item.statusCode >= 400).length;
      const faults = itemsInBucket.filter((item) => item.isFaultInjected).length;

      // Label format: time for 24h, date for 7d/30d
      let label = bucketStart.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

      if (timeRange === '7d' || timeRange === '30d') {
        label = bucketStart.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
      }

      volumeBuckets.push({
        timestamp: label,
        count: itemsInBucket.length,
        errors,
        faults,
      });
    }

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      faultInjectedRequests,
      successRate,
      avgResponseTime,
      minResponseTime,
      maxResponseTime,
      statusBreakdown,
      methodBreakdown,
      volumeOverTime: volumeBuckets,
      timeRange,
    };
  }
}

export const requestLogService = new RequestLogService();

