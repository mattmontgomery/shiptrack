<?php

namespace App\Controller;

use App\Service\UspsService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Annotation\Route;

class TrackController extends AbstractController
{
    private $usps;
    public function __construct(UspsService $usps)
    {
        $this->usps = $usps;
    }
    /**
     * @Route("/track/{service}/{id}", name="track_service_id")
     */
    public function track(string $service, string $id): JsonResponse
    {
        return $this->json([
            'params' => [
                'service' => $service,
                'trackingNumbers' => $id
            ],
            'trackingData' => $this->$service->track(explode(",", $id))
        ]);
    }
}
