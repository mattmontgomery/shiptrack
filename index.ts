import { readFileSync } from "fs";
import nodeFetch from "node-fetch";
import * as YAML from "yaml";
import { parseStringPromise } from "xml2js";
import * as chalk from "chalk";
import { Agent } from "https";
import { toDate, format, formatDistance } from "date-fns";
import { uniq } from "lodash";

const agent = new Agent({
  rejectUnauthorized: false
});

const config = readFileSync("./tracking.yml");
const trackingConfig = YAML.parse(config.toString());

class Tracker {
  public zip: string | number;
  public uspsConfig: IUSPSConfig;
  public tracked: ITracked[] = [];
  constructor(trackingConfig: ITrackingConfig) {
    console.log(
      `${chalk.whiteBright(chalk.bold(chalk.bgGray("Shiptrack starting...")))}`
    );
    console.log("");
    this.zip = trackingConfig.zip;
    this.uspsConfig = {
      app: trackingConfig.usps.app,
      ip: trackingConfig.usps.ip,
      username: trackingConfig.usps.username
    };
    this.track();
  }
  async track() {
    await this.trackUsps(trackingConfig.usps.tracking);
    this.logToday();
    this.tracked.forEach(this.log);
  }
  public trackUsps = async (trackingNumbers = []): Promise<void> => {
    const xml = `<?xml version="1.0" encoding="UTF-8" ?>
        <TrackFieldRequest USERID="${this.uspsConfig.username}">
        <Revision>1</Revision>
        <ClientIp>${this.uspsConfig.ip}</ClientIp>
        <SourceId>${this.uspsConfig.app}</SourceId>
        ${trackingNumbers
          .map(
            trackingNumber =>
              `<TrackID ID="${trackingNumber}"><DestinationZipCode>${this.zip}</DestinationZipCode></TrackID>`
          )
          .join(`\n`)}
        </TrackFieldRequest>`;
    const uri = `https://secure.shippingapis.com/ShippingAPI.dll?API=TrackV2&XML=${xml}`;
    const resp = await nodeFetch(uri, { agent });
    const text = await resp.text();

    const result = await parseStringPromise(text);
    // console.log(JSON.stringify(result, null, 2));
    if (result.TrackResponse && Array.isArray(result.TrackResponse.TrackInfo)) {
      result.TrackResponse.TrackInfo.sort((a, b) => {
        const date_a = a.ExpectedDeliveryDate
          ? Date.parse(a.ExpectedDeliveryDate)
          : Number.POSITIVE_INFINITY;
        const date_b = b.ExpectedDeliveryDate
          ? Date.parse(b.ExpectedDeliveryDate)
          : Number.POSITIVE_INFINITY;
        return date_a > date_b ? 1 : date_a === date_b ? 0 : -1;
      }).forEach(this.commitUsps);
    }
  };
  private commitUsps = (info: IUSPSTracking): void => {
    const trackingNumber = info.$.ID;
    const trackingClass = info.Class.join(", ");
    const expectedDate = info.ExpectedDeliveryDate
      ? info.ExpectedDeliveryDate.join(", ")
      : "";
    const statusSummary = info.StatusSummary.join(", ");
    const origin =
      info.OriginState && info.OriginCity
        ? `${info.OriginCity.join(", ")}, ${info.OriginState.join(", ")}`
        : null;
    this.tracked.push({
      service: "USPS",
      trackingNumber,
      trackingClass,
      expectedDate,
      statusSummary,
      origin
    });
  };
  public logToday = (): void => {
    const dateFormat = "yyyy-MM-dd";
    const today = format(new Date(), dateFormat);
    const arrivingToday = this.tracked.filter(t =>
      !Number.isNaN(Date.parse(t.expectedDate))
        ? format(toDate(Date.parse(t.expectedDate)), dateFormat) === today
        : null
    );
    console.log(
      chalk.bold(
        `There are ${
          arrivingToday.length
        } package(s) arriving today from ${uniq(
          arrivingToday.map(({ service }) => service)
        ).join(", ")}`
      )
    );
    console.log("");
  };
  public log = (info: ITracked): void => {
    console.log(
      `${chalk.bold(info.trackingNumber)} [${info.service} | ${
        info.trackingClass
      }]: ${chalk.blue(
        info.expectedDate
          ? `Expected in ${formatDistance(
              toDate(Date.parse(info.expectedDate)),
              new Date()
            )} (${info.expectedDate})`
          : "No expected date"
      )}`
    );
    if (info.origin) {
      console.log(`${chalk.green(`Arriving from ${info.origin}`)}`);
    }
    console.log(`${chalk.dim(info.statusSummary)}\n`);
  };
}
``;

new Tracker(trackingConfig);

interface IUSPSTracking {
  $: {
    ID: string;
  };
  Class?: string[];
  ExpectedDeliveryDate?: string[];
  StatusSummary?: string[];
  OriginCity?: string[];
  OriginState?: string[];
}
interface IUSPSConfig {
  app: string;
  ip: string;
  username: string;
}
interface ITrackingConfig {
  zip: number | string;
  usps: ITrackingUSPSConfig;
}
interface ITrackingUSPSConfig {
  app: string;
  ip: string;
  username: string;
  tracking: string[];
}

interface ITracked {
  service: "USPS" | "Fedex" | "DHL" | "UPS";
  trackingNumber: string;
  trackingClass: string;
  expectedDate: string;
  statusSummary: string;
  origin: string;
}
