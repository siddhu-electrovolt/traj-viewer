export const getAuthHeaders = () => {
    const credentials = btoa('admin:password123');
    return {
        'Authorization': `Basic ${credentials}`
    };
}; 