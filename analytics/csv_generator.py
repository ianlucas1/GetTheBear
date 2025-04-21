# analytics/csv_generator.py
import pandas as pd
import io

def generate_returns_csv(df_portfolio, df_benchmark, benchmark_ticker):
    """Generates a CSV string buffer containing monthly and annual returns."""
    if df_portfolio is None or df_portfolio.empty:
        # Cannot generate CSV without portfolio data
        return None # Return None for failure case

    # Prepare monthly returns dataframe
    # Ensure required columns exist, create if necessary (with default values)
    if 'Monthly Return' not in df_portfolio.columns:
        if 'Portfolio Value' in df_portfolio.columns:
            df_portfolio['Monthly Return'] = df_portfolio['Portfolio Value'].pct_change()
        else: # Cannot proceed without returns
            return None 
            
    monthly_returns = pd.DataFrame(index=df_portfolio.index)
    # Fill NaNs in returns before proceeding
    monthly_returns["Portfolio_Return"] = df_portfolio["Monthly Return"].fillna(0)
    monthly_returns.index.name = "Date"

    # Add year and month columns
    if pd.api.types.is_datetime64_any_dtype(monthly_returns.index):
        monthly_returns["Year"] = monthly_returns.index.year
        monthly_returns["Month"] = monthly_returns.index.month
    else:
        # Attempt conversion if not datetime, log warning or error if fails
        try:
             monthly_returns.index = pd.to_datetime(monthly_returns.index)
             monthly_returns["Year"] = monthly_returns.index.year
             monthly_returns["Month"] = monthly_returns.index.month
        except Exception:
             # Handle error: maybe return None or raise, depending on desired strictness
             return None 

    # Base column order
    column_order = ["Year", "Month", "Portfolio_Return"]

    # Add benchmark monthly returns if available
    if df_benchmark is not None and not df_benchmark.empty and 'Monthly Return' in df_benchmark.columns:
        monthly_returns["Benchmark_Return"] = (
            df_benchmark["Monthly Return"]
            .reindex(monthly_returns.index)
            .fillna(0) # Fill missing benchmark returns with 0
        )
        column_order.append("Benchmark_Return")
    elif "Benchmark_Return" in monthly_returns.columns:
         # Ensure column exists even if benchmark df was bad, fill with 0
         monthly_returns["Benchmark_Return"] = 0.0
         if "Benchmark_Return" not in column_order:
              column_order.append("Benchmark_Return")


    # Helper function to calculate annual return from monthly data
    def calculate_annual_return(monthly_returns_series):
        # Ensure series is numeric and handle potential non-numeric errors
        numeric_series = pd.to_numeric(monthly_returns_series, errors='coerce').fillna(0)
        if numeric_series.empty:
            return 0.0
        # Compounded return: (1 + r1) * (1 + r2) * ... * (1 + rn) - 1
        # Handle potential overflow if returns are very large
        try:
            compounded_value = (1 + numeric_series).prod()
            # Check for infinity
            if pd.isna(compounded_value) or compounded_value == float('inf') or compounded_value == float('-inf'):
                 return float('nan') # Represent overflow/invalid result
            return (compounded_value - 1) * 100
        except OverflowError:
             return float('nan') # Indicate overflow

    # Calculate annual returns for portfolio and benchmark
    annual_returns_list = []
    # Ensure Year column exists before grouping
    if "Year" in monthly_returns.columns:
        grouped = monthly_returns.groupby("Year")
        for year, group in grouped:
            year_data = {"Year": int(year)} # Ensure year is int
            portfolio_ann_return = calculate_annual_return(group["Portfolio_Return"])
            year_data["Portfolio_Ann_Return"] = portfolio_ann_return if not pd.isna(portfolio_ann_return) else 'N/A'
            
            if "Benchmark_Return" in group.columns:
                benchmark_ann_return = calculate_annual_return(group["Benchmark_Return"])
                year_data["Benchmark_Ann_Return"] = benchmark_ann_return if not pd.isna(benchmark_ann_return) else 'N/A'
            elif "Benchmark_Return" in monthly_returns.columns: # Ensure consistent columns
                 year_data["Benchmark_Ann_Return"] = 'N/A'
                 
            annual_returns_list.append(year_data)

    annual_returns = pd.DataFrame(annual_returns_list)

    # Convert monthly returns to percentage strings for output (after annual calc)
    # Apply formatting carefully to avoid issues with non-numeric data
    monthly_returns_output = monthly_returns.copy()
    for col in ["Portfolio_Return", "Benchmark_Return"]:
         if col in monthly_returns_output.columns:
              # Multiply by 100 AFTER ensuring it's numeric
              numeric_col = pd.to_numeric(monthly_returns_output[col], errors='coerce') * 100
              # Format as string with 2 decimal places, handle NaN
              monthly_returns_output[col] = numeric_col.apply(lambda x: f"{x:.2f}" if pd.notna(x) else 'N/A')

    # Reorder columns for monthly output
    monthly_returns_output = monthly_returns_output[column_order]

    # Reorder annual returns columns
    annual_column_order = ["Year", "Portfolio_Ann_Return"]
    if "Benchmark_Ann_Return" in annual_returns.columns:
        annual_column_order.append("Benchmark_Ann_Return")
    elif "Benchmark_Return" in monthly_returns.columns: # Add if benchmark was expected
         if "Benchmark_Ann_Return" not in annual_returns.columns:
             annual_returns["Benchmark_Ann_Return"] = 'N/A'
         annual_column_order.append("Benchmark_Ann_Return")
         
    # Ensure all expected columns exist before reordering
    for col in annual_column_order:
        if col not in annual_returns.columns:
             annual_returns[col] = 'N/A' # Add missing column with N/A
             
    annual_returns = annual_returns[annual_column_order]

    # Create the CSV buffer
    csv_buffer = io.StringIO()
    csv_buffer.write("MONTHLY RETURNS\n")
    # Write monthly data - use index=True, quotechar='"', quoting=csv.QUOTE_NONNUMERIC could be useful
    monthly_returns_output.to_csv(csv_buffer, index=True) 

    csv_buffer.write("\n\nANNUAL RETURNS\n")
    # Write annual data - use index=False
    annual_returns.to_csv(csv_buffer, index=False)

    csv_buffer.seek(0)
    
    # Generate filename
    filename = f"portfolio_vs_{benchmark_ticker}_returns.csv"

    return csv_buffer, filename 