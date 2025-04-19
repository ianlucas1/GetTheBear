/**
 * Date picker module for portfolio analysis
 */

/**
 * Initialize date picker with default values
 * Sets default dates (5 years from today) and max dates
 */
export function initializeDatePicker() {
    const today = new Date();
    const endDateInput = document.getElementById('end-date');
    const startDateInput = document.getElementById('start-date');
    
    if (!endDateInput || !startDateInput) return;
    
    // Format today's date as YYYY-MM-DD
    const endDateStr = today.toISOString().split('T')[0];
    endDateInput.value = endDateStr;
    
    // Default start date (5 years ago)
    const startDate = new Date();
    startDate.setFullYear(today.getFullYear() - 5);
    const startDateStr = startDate.toISOString().split('T')[0];
    startDateInput.value = startDateStr;
    
    // Set max date to today
    endDateInput.max = endDateStr;
    startDateInput.max = endDateStr;
}

/**
 * Get the current date values from the form
 * @returns {Object} Object containing start_date and end_date
 */
export function getDateValues() {
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    
    return {
        start_date: startDateInput ? startDateInput.value : '',
        end_date: endDateInput ? endDateInput.value : ''
    };
} 