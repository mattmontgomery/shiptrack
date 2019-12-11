<?php

namespace App\Service;

use App\Client\UspsClient;
use App\Model\UspsTrackingModel;
use Doctrine\Common\Annotations\AnnotationReader;
use Symfony\Component\PropertyInfo\Extractor\PhpDocExtractor;
use Symfony\Contracts\HttpClient\HttpClientInterface;
use Symfony\Component\Serializer\Encoder\XmlEncoder;
use Symfony\Component\Serializer\Mapping\Factory\ClassMetadataFactory;
use Symfony\Component\Serializer\Mapping\Loader\AnnotationLoader;
use Symfony\Component\Serializer\Normalizer\ArrayDenormalizer;
use Symfony\Component\Serializer\Normalizer\DateTimeNormalizer;
use Symfony\Component\Serializer\Normalizer\ObjectNormalizer;
use Symfony\Component\Serializer\Serializer;


class UspsService
{
    private $client;
    private $username;
    private $zip;
    public function __construct(HttpClientInterface $client, string $username, string $zip)
    {
        $this->client = $client;
        $this->username = $username;
        $this->zip = $zip;
    }
    public function track(array $trackingNumbers)
    {
        $xml = $this->generateXml($trackingNumbers);
        $response = $this->client->request('GET', sprintf('/ShippingAPI.dll?API=TrackV2&xml=%s', $xml));
        $responseXml = $response->getContent();

        $classMetadataFactory = new ClassMetadataFactory(new AnnotationLoader(new AnnotationReader()));

        $objectNormalizer = new ObjectNormalizer($classMetadataFactory, null, null, new PhpDocExtractor());

        $xmlEncoder = new XmlEncoder();
        $serializer = new Serializer([new DateTimeNormalizer(), new ArrayDenormalizer(), $objectNormalizer], [$xmlEncoder]);

        $content = $serializer->deserialize($responseXml, UspsTrackingModel::class, 'xml');
        // ini_set('xdebug.var_display_max_depth', 6);
        // var_dump(simplexml_load_string($responseXml));
        // die();

        return [
            'trackingNumbers' => $trackingNumbers,
            'content' => $content
        ];
    }
    private function generateXml(array $trackingNumbers)
    {
        return sprintf(
            '<?xml version="1.0" encoding="UTF-8" ?><TrackFieldRequest USERID="%s"><Revision>1</Revision><ClientIp>%s</ClientIp><SourceId>%s</SourceId>%s</TrackFieldRequest>',
            $this->username,
            "127.0.0.1",
            "test-app",
            implode("", array_map(function ($trackingNumber) {
                return sprintf('<TrackID ID="%s"><DestinationZipCode>%s</DestinationZipCode></TrackID>', $trackingNumber, $this->zip);
            }, $trackingNumbers)),
            "84103"
        );
    }
}
