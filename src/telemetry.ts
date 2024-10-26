import { InfluxDBClient, Point } from "@influxdata/influxdb3-client";

let influxClient: InfluxDBClient;
let influxDatabase: string;

function setupInflux() {
  if (
    !process.env.INFLUX_TOKEN ||
    !process.env.INFLUX_HOST ||
    !process.env.INFLUX_DATABASE
  ) {
    console.info("Influx envvars not setup.");
    return;
  }
  influxDatabase = process.env.INFLUX_DATABASE;

  try {
    influxClient = new InfluxDBClient({
      host: process.env.INFLUX_HOST,
      token: process.env.INFLUX_TOKEN,
    });
  } catch (error) {
    console.error("Influx setup error", error);
  }
}

setupInflux();

export function send(
  action: string,
  fields: {
    [key: string]: number | boolean | string;
  }
) {
  if (!influxClient) {
    return;
  }
  try {
    const point = Point.measurement("telemetry")
      .setTag("action", action)
      .setFields(fields);
    influxClient.write(point, influxDatabase);
  } catch (error) {
    console.error("Influx telemetry error", error);
  }
}
