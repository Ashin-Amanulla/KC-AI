use schads_calculator::{calculate_pay, PayInput};
use std::{env, fs, process::ExitCode};

fn main() -> ExitCode {
    let Some(path) = env::args().nth(1) else {
        eprintln!("usage: schads-calculator <input.json>");
        return ExitCode::from(2);
    };
    let input = match fs::read_to_string(&path)
        .map_err(|e| e.to_string())
        .and_then(|text| serde_json::from_str::<PayInput>(&text).map_err(|e| e.to_string()))
    {
        Ok(input) => input,
        Err(error) => {
            eprintln!("invalid input: {error}");
            return ExitCode::from(2);
        }
    };
    let result = match calculate_pay(input) {
        Ok(result) => result,
        Err(error) => {
            eprintln!("calculation failed: {error}");
            return ExitCode::from(1);
        }
    };
    match serde_json::to_string_pretty(&result) {
        Ok(json) => {
            println!("{json}");
            ExitCode::SUCCESS
        }
        Err(error) => {
            eprintln!("could not serialize result: {error}");
            ExitCode::from(1)
        }
    }
}
