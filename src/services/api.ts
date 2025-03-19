import { getAuthHeaders } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export interface TraceData {
    _id: string;
    trace_id: string;
    workflow_name: string;
    group_id: string | null;
    metadata: any;
    spans?: any[];
    isComplete: boolean;
    created_at: string;
    updated_at: string;
}

export interface ApiResponse<T> {
    success: boolean;
    data: T;
    pagination?: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

export const fetchTraces = async (page: number, limit: number): Promise<ApiResponse<TraceData[]>> => {
    const response = await fetch(
        `${API_BASE_URL}/traces?page=${page}&limit=${limit}`,
        {
            headers: {
                ...getAuthHeaders()
            }
        }
    );
    
    if (!response.ok) {
        throw new Error('Failed to fetch traces');
    }
    
    return response.json();
};

export const fetchTraceById = async (traceId: string): Promise<ApiResponse<TraceData>> => {
    const response = await fetch(
        `${API_BASE_URL}/traces/${traceId}`,
        {
            headers: {
                ...getAuthHeaders()
            }
        }
    );
    
    if (!response.ok) {
        throw new Error('Failed to fetch trace');
    }
    
    return response.json();
}; 