def calculate_total_risk(health: float, environment: float, transmission: float, biosecurity: float, local: float = 0.0) -> float:
    """
    Calculates the overall biosecurity risk percentage for a farm zone.
    Higher percentage = Higher risk of disease outbreak.
    
    All inputs should be a score from 0 to 100.
    """
    
    # 1. Define the weight of each factor (must sum to 1.0)
    # This determines how heavily each metric impacts the final score.
    WEIGHTS = {
        "health": 0.40,        # Sick birds, mortality rate (Highest priority)
        "environment": 0.25,   # Temp, humidity, ammonia levels
        "transmission": 0.20,  # Movement of people/vehicles between sheds
        "biosecurity": 0.15    # Disinfection frequency, PPE usage
    }

    # 2. Calculate the weighted base score
    base_score = (
        (health * WEIGHTS["health"]) +
        (environment * WEIGHTS["environment"]) +
        (transmission * WEIGHTS["transmission"]) +
        (biosecurity * WEIGHTS["biosecurity"])
    )

    # 3. Apply the local modifier 
    # (e.g., A +20 penalty if a neighboring farm has a bird flu outbreak)
    total_score = base_score + local

    # 4. Cap the results
    # Ensure the final score never drops below 0% or exceeds 100%
    final_risk = max(0.0, min(total_score, 100.0))
    
    return round(final_risk, 2)
